import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AssinaturaInsight, Logo, Spinner } from '../../components/ui/Ui'
import { mudarTalaoCozinha, obterTaloesCozinha } from '../../lib/api'
import { ESPERA_LONGA_MIN, minutosDeEspera, pedidoFaladoDoTalao } from '../../lib/cozinha'
import { mensagemDeErro } from '../../lib/errors'
import { formatarHora } from '../../lib/format'
import { useLocutor } from '../../lib/som'
import type { AcaoCozinha, TalaoCozinha } from '../../lib/types'

// Ecrã da cozinha, num tablet ou telemóvel fixo: os pedidos com comida, tal como o cliente os
// escolheu (opção e notas incluídas), do mais antigo para o mais recente. Abre-se pelo link do
// separador "🍳 Cozinha" do painel, sem palavra-passe; atualiza de 4 em 4 segundos.

const INTERVALO_MS = 4000

export function CozinhaPage() {
  const { token = '' } = useParams()
  const [taloes, setTaloes] = useState<TalaoCozinha[] | null>(null)
  const [invalido, setInvalido] = useState(false)
  const [semLigacao, setSemLigacao] = useState(false)
  const [aMudar, setAMudar] = useState<string | null>(null)
  const [agora, setAgora] = useState(Date.now())
  const { locutor, somAtivo, aLer } = useLocutor()
  // Talões já vistos: só os que aparecem depois de abrir o ecrã tocam o sininho.
  const conhecidos = useRef<Set<string> | null>(null)

  const atualizar = useCallback(async () => {
    try {
      const lista = await obterTaloesCozinha(token)
      if (conhecidos.current) {
        for (const t of lista) {
          if (!conhecidos.current.has(t.id) && t.estado !== 'cancelado') locutor.anunciar(t.id, Promise.resolve(pedidoFaladoDoTalao(t)))
        }
      }
      conhecidos.current = new Set(lista.map((t) => t.id))
      setTaloes(lista)
      setSemLigacao(false)
      setAgora(Date.now())
    } catch (e) {
      if ((e as { hint?: string }).hint === 'cozinha_invalida') setInvalido(true)
      else setSemLigacao(true)
    }
  }, [token, locutor])

  useEffect(() => {
    void atualizar()
    const id = window.setInterval(() => document.visibilityState === 'visible' && void atualizar(), INTERVALO_MS)
    const aoVoltar = () => document.visibilityState === 'visible' && void atualizar()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [atualizar])

  // Ecrã sempre aceso enquanto o som está ligado (pede outra vez quando a página volta a ficar visível).
  useEffect(() => {
    if (!somAtivo || !('wakeLock' in navigator)) return
    let trinco: WakeLockSentinel | null = null
    const pedir = () =>
      navigator.wakeLock
        .request('screen')
        .then((t) => (trinco = t))
        .catch(() => undefined)
    void pedir()
    const aoVoltar = () => document.visibilityState === 'visible' && void pedir()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar)
      void trinco?.release()
    }
  }, [somAtivo])

  async function mudar(t: TalaoCozinha, acao: AcaoCozinha) {
    setAMudar(t.id)
    try {
      await mudarTalaoCozinha(token, t.id, acao)
      await atualizar()
    } catch (e) {
      window.alert(mensagemDeErro(e))
    } finally {
      setAMudar(null)
    }
  }

  if (invalido) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink-950 px-6 text-center text-cream-50">
        <Logo claro />
        <h1 className="font-display text-2xl text-gold-300">Link da cozinha inválido</h1>
        <p className="max-w-xs text-cream-200">Peça um novo no painel, no separador “🍳 Cozinha”.</p>
      </main>
    )
  }

  const porFazer = taloes?.filter((t) => t.estado !== 'cancelado').length ?? 0

  return (
    <div className="min-h-dvh bg-ink-950 text-cream-50">
      <header className="sticky top-0 z-20 border-b border-gold-500/30 bg-ink-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <Logo claro />
            <span className="rounded-lg bg-gold-500 px-3 py-1 font-display text-xl text-ink-950">🍳 Cozinha</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold">
              {porFazer} pedido{porFazer === 1 ? '' : 's'}
            </span>
            {somAtivo ? (
              <span className="rounded-full bg-basil-500 px-3 py-1 font-semibold text-white">🔔 Som ligado</span>
            ) : (
              <span className="animate-pulse rounded-full bg-gold-500 px-3 py-1 font-semibold text-ink-950">🔔 Toque no ecrã para ligar o som</span>
            )}
          </div>
        </div>
        {semLigacao && <p className="bg-ember-600 px-4 py-1.5 text-center text-sm font-semibold">Sem ligação à internet. A tentar outra vez…</p>}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5">
        {taloes === null ? (
          <Spinner rotulo="A abrir a cozinha…" />
        ) : taloes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-24 text-center">
            <p className="font-display text-3xl text-gold-300">Sem pedidos na cozinha</p>
            <p className="max-w-sm text-cream-200">Os pedidos novos aparecem aqui sozinhos, com o sininho e a voz.</p>
          </div>
        ) : (
          <ul className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {taloes.map((t) => (
              <li key={t.id}>
                <Talao talao={t} agora={agora} aLer={aLer === t.id} ocupado={aMudar === t.id} aoMudar={(a) => void mudar(t, a)} />
              </li>
            ))}
          </ul>
        )}
        <AssinaturaInsight fundoEscuro className="mt-12" />
      </main>
    </div>
  )
}

function Talao({ talao: t, agora, aLer, ocupado, aoMudar }: { talao: TalaoCozinha; agora: number; aLer: boolean; ocupado: boolean; aoMudar: (a: AcaoCozinha) => void }) {
  const cancelado = t.estado === 'cancelado'
  const minutos = minutosDeEspera(t.criado_em, agora)
  const aPreparar = Boolean(t.cozinha_inicio_em)
  return (
    <article
      className={`overflow-hidden rounded-2xl shadow-xl ${
        cancelado ? 'bg-ember-600 text-white' : 'bg-cream-50 text-ink-900'
      } ${aLer ? 'ring-4 ring-ember-500' : aPreparar && !cancelado ? 'ring-4 ring-gold-400' : ''}`}
    >
      <header className={`flex items-center justify-between gap-3 px-4 py-3 ${cancelado ? 'bg-ember-500' : 'bg-ink-900 text-cream-50'}`}>
        <span className="font-display text-3xl text-gold-300">{t.mesa}</span>
        <span className="flex flex-col items-end leading-tight">
          <span className="text-lg font-semibold">{formatarHora(t.criado_em)}</span>
          <span className={`text-sm font-bold ${minutos >= ESPERA_LONGA_MIN && !cancelado ? 'rounded bg-ember-500 px-1.5 text-white' : 'text-cream-200'}`}>
            há {minutos} min
          </span>
        </span>
      </header>

      {cancelado ? (
        <p className="px-4 pt-3 text-xl font-extrabold uppercase">Cancelado: não fazer</p>
      ) : (
        aPreparar && <p className="px-4 pt-3 text-sm font-extrabold uppercase tracking-wide text-gold-600">A preparar</p>
      )}

      <ul className={`flex flex-col gap-3 px-4 py-3 ${cancelado ? 'line-through opacity-80' : ''}`}>
        {t.itens.map((i, n) => (
          <li key={n} className="text-xl leading-snug">
            <strong className="tabular-nums">{i.quantidade}×</strong> {i.nome}
            {i.opcao && <span className={`ml-2 rounded-md px-2 py-0.5 text-lg font-extrabold uppercase ${cancelado ? 'bg-white/20' : 'bg-gold-300 text-ink-950'}`}>{i.opcao}</span>}
            {i.nota && <span className={`mt-1 block rounded-md px-2 py-1 text-base font-bold ${cancelado ? 'bg-white/20' : 'bg-ember-500/10 text-ember-600'}`}>Nota: {i.nota}</span>}
          </li>
        ))}
      </ul>
      {t.nota_geral && (
        <p className={`mx-4 mb-3 rounded-md px-2 py-1 text-base font-bold ${cancelado ? 'bg-white/20' : 'bg-ember-500/10 text-ember-600'}`}>Nota do pedido: {t.nota_geral}</p>
      )}

      <footer className="flex gap-2 border-t border-black/10 px-4 py-3">
        {cancelado ? (
          <button type="button" className="btn flex-1 bg-white py-3.5 text-lg text-ember-600" disabled={ocupado} onClick={() => aoMudar('ok')}>
            OK
          </button>
        ) : (
          <>
            {!aPreparar && (
              <button type="button" className="btn-primario flex-1 py-3.5 text-lg" disabled={ocupado} onClick={() => aoMudar('comecar')}>
                Começar
              </button>
            )}
            <button type="button" className="btn flex-1 bg-basil-500 py-3.5 text-lg text-white hover:bg-basil-600" disabled={ocupado} onClick={() => aoMudar('pronto')}>
              ✓ Pronto
            </button>
          </>
        )}
      </footer>
    </article>
  )
}
