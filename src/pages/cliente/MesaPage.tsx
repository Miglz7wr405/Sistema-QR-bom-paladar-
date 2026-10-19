import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Cardapio } from '../../components/cliente/Cardapio'
import { FolhaCarrinho } from '../../components/cliente/FolhaCarrinho'
import { FolhaPrato } from '../../components/cliente/FolhaPrato'
import { MeusPedidos } from '../../components/cliente/MeusPedidos'
import { Aviso, Logo, Spinner } from '../../components/ui/Ui'
import { enviarPedido, obterCardapio, obterMesa, obterPedidosDaMesa } from '../../lib/api'
import { carrinhoReducer, contarItens, paraPedido, totalCarrinho, type LinhaCarrinho } from '../../lib/cart'
import { mensagemDeErro } from '../../lib/errors'
import { formatarPreco } from '../../lib/format'
import type { Categoria, MesaInfo, PedidoCliente, Prato } from '../../lib/types'

type Estado =
  | { fase: 'a-carregar' }
  | { fase: 'invalida' }
  | { fase: 'erro'; mensagem: string }
  | { fase: 'pronta'; mesa: MesaInfo; categorias: Categoria[]; pratos: Prato[] }

const INTERVALO_PEDIDOS = 10_000

function carrinhoGuardado(token: string): LinhaCarrinho[] {
  try {
    const bruto = sessionStorage.getItem(`carrinho:${token}`)
    return bruto ? (JSON.parse(bruto) as LinhaCarrinho[]) : []
  } catch {
    return []
  }
}

export function MesaPage() {
  const { token = '' } = useParams()
  const [estado, setEstado] = useState<Estado>({ fase: 'a-carregar' })
  const [separador, setSeparador] = useState<'cardapio' | 'pedidos'>('cardapio')
  const [linhas, dispatch] = useReducer(carrinhoReducer, token, carrinhoGuardado)
  const [pratoAberto, setPratoAberto] = useState<Prato | null>(null)
  const [carrinhoAberto, setCarrinhoAberto] = useState(false)
  const [notaGeral, setNotaGeral] = useState('')
  const [aEnviar, setAEnviar] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [confirmado, setConfirmado] = useState<{ total: number } | null>(null)
  const [pedidos, setPedidos] = useState<PedidoCliente[] | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const enviando = useRef(false)

  const carregar = useCallback(async () => {
    setEstado({ fase: 'a-carregar' })
    try {
      const [mesa, cardapio] = await Promise.all([obterMesa(token), obterCardapio()])
      if (!mesa) return setEstado({ fase: 'invalida' })
      setEstado({ fase: 'pronta', mesa, ...cardapio })
    } catch (e) {
      setEstado({ fase: 'erro', mensagem: mensagemDeErro(e) })
    }
  }, [token])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    try {
      sessionStorage.setItem(`carrinho:${token}`, JSON.stringify(linhas))
    } catch {
      /* sem armazenamento: o carrinho só vive na página */
    }
  }, [linhas, token])

  const atualizarPedidos = useCallback(async () => {
    try {
      setPedidos(await obterPedidosDaMesa(token))
    } catch {
      /* tenta outra vez no próximo ciclo */
    }
  }, [token])

  // "Os meus pedidos": polling simples a cada 10 s enquanto a página está visível.
  useEffect(() => {
    if (estado.fase !== 'pronta') return
    void atualizarPedidos()
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void atualizarPedidos()
    }, INTERVALO_PEDIDOS)
    const aoVoltar = () => document.visibilityState === 'visible' && void atualizarPedidos()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [estado.fase, atualizarPedidos])

  useEffect(() => {
    if (!aviso) return
    const id = window.setTimeout(() => setAviso(null), 2200)
    return () => window.clearTimeout(id)
  }, [aviso])

  async function enviar() {
    if (enviando.current || linhas.length === 0) return
    enviando.current = true
    setAEnviar(true)
    setErroEnvio(null)
    try {
      const r = await enviarPedido(token, paraPedido(linhas), notaGeral.trim() || null)
      dispatch({ tipo: 'esvaziar' })
      setNotaGeral('')
      setCarrinhoAberto(false)
      setConfirmado({ total: Number(r.total) })
      void atualizarPedidos()
    } catch (e) {
      setErroEnvio(mensagemDeErro(e))
      // Um prato pode ter esgotado entretanto: atualiza o cardápio.
      if ((e as { hint?: string }).hint === 'esgotado') {
        obterCardapio()
          .then((c) => setEstado((s) => (s.fase === 'pronta' ? { ...s, ...c } : s)))
          .catch(() => undefined)
      }
    } finally {
      enviando.current = false
      setAEnviar(false)
    }
  }

  if (estado.fase === 'a-carregar') {
    return (
      <div className="min-h-dvh bg-cream-50">
        <Spinner rotulo="A abrir o cardápio…" />
      </div>
    )
  }

  if (estado.fase === 'invalida') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink-900 px-6 text-center text-cream-50">
        <Logo claro />
        <h1 className="font-display text-2xl text-gold-300">QR Code inválido</h1>
        <p className="max-w-xs text-cream-200">Este código não corresponde a nenhuma mesa. Por favor, chame um empregado.</p>
      </main>
    )
  }

  if (estado.fase === 'erro') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cream-50 px-6 text-center">
        <Logo />
        <Aviso>{estado.mensagem}</Aviso>
        <button type="button" className="btn-primario" onClick={() => void carregar()}>
          Tentar de novo
        </button>
      </main>
    )
  }

  const { mesa, categorias, pratos } = estado
  const nItens = contarItens(linhas)
  const pedidosAbertos = pedidos?.filter((p) => p.estado !== 'cancelado' && p.estado !== 'entregue').length ?? 0

  return (
    <div className="min-h-dvh bg-cream-50 pb-32">
      <header className="sticky top-0 z-30 bg-ink-900 text-cream-50 shadow-md">
        <div className="mx-auto flex h-[60px] max-w-2xl items-center justify-between px-4">
          <Logo claro />
          <span className="rounded-full bg-gold-500 px-3.5 py-1 font-display text-lg text-ink-950">{mesa.nome}</span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4">
        <div role="tablist" aria-label="Secções" className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-cream-100 p-1">
          {(
            [
              ['cardapio', 'Cardápio'],
              ['pedidos', 'Os meus pedidos'],
            ] as const
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={separador === valor}
              onClick={() => {
                setSeparador(valor)
                window.scrollTo({ top: 0 })
              }}
              className={`min-h-10 rounded-lg text-sm font-semibold transition ${separador === valor ? 'bg-white text-ink-900 shadow-sm' : 'text-muted'}`}
            >
              {rotulo}
              {valor === 'pedidos' && pedidosAbertos > 0 && (
                <span className="ml-1.5 rounded-full bg-ember-500 px-1.5 text-xs text-white">{pedidosAbertos}</span>
              )}
            </button>
          ))}
        </div>

        {separador === 'cardapio' ? (
          <Cardapio categorias={categorias} pratos={pratos} aoEscolher={setPratoAberto} />
        ) : (
          <MeusPedidos pedidos={pedidos} aoVerCardapio={() => setSeparador('cardapio')} />
        )}
      </div>

      {nItens > 0 && !confirmado && (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-cream-50 via-cream-50 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
          <button type="button" onClick={() => setCarrinhoAberto(true)} className="btn-primario mx-auto flex w-full max-w-2xl justify-between py-4 text-base shadow-xl">
            <span className="rounded-lg bg-gold-500 px-2 py-0.5 text-sm text-ink-950">{nItens}</span>
            <span>Ver pedido</span>
            <span className="tabular-nums">{formatarPreco(totalCarrinho(linhas))}</span>
          </button>
        </div>
      )}

      {aviso && (
        <div role="status" className="fixed inset-x-0 top-20 z-50 mx-auto w-fit rounded-full bg-ink-900 px-4 py-2 text-sm text-gold-200 shadow-lg">
          {aviso}
        </div>
      )}

      <FolhaPrato
        prato={pratoAberto}
        aoFechar={() => setPratoAberto(null)}
        aoAdicionar={(acao) => {
          dispatch(acao)
          setPratoAberto(null)
          setAviso(`${acao.quantidade}× ${acao.prato.nome} no carrinho`)
        }}
      />

      <FolhaCarrinho
        aberta={carrinhoAberto}
        aoFechar={() => setCarrinhoAberto(false)}
        linhas={linhas}
        dispatch={dispatch}
        notaGeral={notaGeral}
        setNotaGeral={setNotaGeral}
        aEnviar={aEnviar}
        erro={erroEnvio}
        aoEnviar={() => void enviar()}
      />

      {confirmado && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-ink-900 px-6 text-center text-cream-50" role="dialog" aria-modal="true" aria-label="Pedido enviado">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-basil-500 text-4xl" aria-hidden>
            ✓
          </span>
          <h1 className="font-display text-3xl text-gold-300">Pedido enviado!</h1>
          <p className="max-w-xs text-cream-200">
            O pedido da <strong className="text-cream-50">{mesa.nome}</strong> chegou à cozinha. Total: {formatarPreco(confirmado.total)}.
          </p>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <button
              type="button"
              className="btn-dourado py-3.5"
              onClick={() => {
                setConfirmado(null)
                setSeparador('cardapio')
              }}
            >
              Pedir mais
            </button>
            <button
              type="button"
              className="btn border border-cream-200/30 py-3.5 text-cream-50"
              onClick={() => {
                setConfirmado(null)
                setSeparador('pedidos')
                window.scrollTo({ top: 0 })
              }}
            >
              Ver os meus pedidos
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
