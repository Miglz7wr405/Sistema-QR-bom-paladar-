import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useRealtime } from '../../components/admin/AdminLayout'
import { BlocoMesa } from '../../components/admin/BlocoMesa'
import { Aviso, Spinner, Vazio } from '../../components/ui/Ui'
import { mensagemDeErro } from '../../lib/errors'
import { formatarHora, formatarPreco } from '../../lib/format'
import { agruparPorMesa } from '../../lib/mesas'
import { supabase } from '../../lib/supabase'
import type { EstadoPedido, Mesa, Pedido, Sessao } from '../../lib/types'

type MesaBase = Pick<Mesa, 'id' | 'numero' | 'nome'>
type SessaoAberta = Pick<Sessao, 'id' | 'table_id' | 'aberta_em'>

export function MesasPage() {
  const { versao, mesasNovas } = useRealtime()
  const [mesas, setMesas] = useState<MesaBase[] | null>(null)
  const [sessoes, setSessoes] = useState<SessaoAberta[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const [m, s] = await Promise.all([
        supabase.from('restaurant_tables').select('id, numero, nome').eq('ativa', true).order('numero'),
        supabase.from('table_sessions').select('id, table_id, aberta_em').is('fechada_em', null),
      ])
      if (m.error || s.error) throw m.error ?? s.error
      const ids = s.data.map((x) => x.id)
      const p = ids.length
        ? await supabase.from('orders').select('*, order_items(*)').in('session_id', ids).order('criado_em')
        : { data: [] as Pedido[], error: null }
      if (p.error) throw p.error
      if (ativo) {
        setMesas(m.data)
        setSessoes(s.data)
        setPedidos((p.data ?? []) as Pedido[])
        setErro(null)
      }
    }
    carregar().catch((e) => ativo && setErro(mensagemDeErro(e)))
    return () => {
      ativo = false
    }
  }, [versao])

  // "✓ Atendido" ou "Cancelar": o pedido fica no bloco da mesa (a conta só fecha com "Fechar mesa").
  async function mudarEstado(pedido: Pedido, estado: EstadoPedido) {
    setOcupado(true)
    const { error } = await supabase.from('orders').update({ estado }).eq('id', pedido.id)
    setOcupado(false)
    if (error) return setErro(mensagemDeErro(error))
    setPedidos((l) => l.map((x) => (x.id === pedido.id ? { ...x, estado, atualizado_em: new Date().toISOString() } : x)))
  }

  /** Depois de "Fechar mesa": o bloco sai e a mesa fica livre; o próximo cliente começa do zero. */
  function mesaFechada(sessaoId: string) {
    setSessoes((l) => l.filter((x) => x.id !== sessaoId))
    setPedidos((l) => l.filter((x) => x.session_id !== sessaoId))
  }

  if (erro && !mesas) return <Aviso>{erro}</Aviso>
  if (!mesas) return <Spinner />
  if (mesas.length === 0) {
    return (
      <Vazio titulo="Não há mesas ativas" texto="Adicione mesas em “Gerir mesas”.">
        <Link to="/admin/mesas" className="btn-primario mt-3">
          Gerir mesas
        </Link>
      </Vazio>
    )
  }

  const contas = agruparPorMesa(sessoes, pedidos)
  const contaDa = (mesaId: string) => contas.find((c) => c.sessao.table_id === mesaId)
  const nomeDa = (mesaId: string) => mesas.find((m) => m.id === mesaId)?.nome ?? 'Mesa'
  const porAtender = contas.reduce((s, c) => s + c.porAtender, 0)
  const ocupadas = mesas.filter((m) => sessoes.some((x) => x.table_id === m.id)).length
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <h1 className="font-display text-2xl">Painel</h1>
        <p className="text-sm text-muted">
          {ocupadas} ocupada{ocupadas === 1 ? '' : 's'} de {mesas.length} · total em aberto{' '}
          <strong className="text-ink-900">{formatarPreco(contas.reduce((s, c) => s + c.total, 0))}</strong>
        </p>
      </div>
      {erro && (
        <div className="mb-4">
          <Aviso>{erro}</Aviso>
        </div>
      )}
      <section aria-labelledby="pedidos-mesas" className="mb-8">
        <h2 id="pedidos-mesas" className="mb-3 flex items-center gap-2 font-display text-xl">
          Pedidos das mesas
          {porAtender > 0 && <span className="rounded-full bg-ember-500 px-2 text-base text-white">{porAtender} por atender</span>}
        </h2>
        {contas.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-cream-200 px-4 py-5 text-center text-muted">✓ Sem pedidos. Os pedidos novos aparecem aqui na hora.</p>
        ) : (
          <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {contas.map((c) => (
              <BlocoMesa
                key={c.sessao.id}
                conta={c}
                mesaNome={nomeDa(c.sessao.table_id)}
                comLink
                ocupado={ocupado}
                aoMudarEstado={(p, e) => void mudarEstado(p, e)}
                aoFechar={() => mesaFechada(c.sessao.id)}
                aoErro={setErro}
              />
            ))}
          </div>
        )}
      </section>

      <h2 className="mb-3 font-display text-xl">Mesas</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {mesas.map((m) => {
          const nova = mesasNovas.has(m.id)
          const ocupada = sessoes.some((x) => x.table_id === m.id)
          const conta = contaDa(m.id)
          const porEntregar = conta?.porAtender ?? 0
          return (
            <li key={m.id}>
              <Link
                to={`/admin/mesas/${m.id}`}
                className={`flex h-full min-h-36 flex-col rounded-2xl border-2 p-4 transition hover:-translate-y-0.5 hover:shadow-lg ${
                  nova
                    ? 'animate-pulse border-ember-500 bg-ember-500/10'
                    : ocupada
                      ? 'border-gold-500 bg-white'
                      : 'border-cream-200 bg-cream-100/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-display text-2xl">{m.nome}</span>
                  {nova && <span className="rounded-full bg-ember-500 px-2 py-0.5 text-xs font-bold text-white">NOVO</span>}
                </div>
                {ocupada ? (
                  <div className="mt-auto flex flex-col gap-0.5 pt-3 text-sm">
                    <span className="text-lg font-semibold tabular-nums text-ink-900">{formatarPreco(conta?.total ?? 0)}</span>
                    <span className={porEntregar > 0 ? 'font-semibold text-ember-600' : 'text-muted'}>
                      {porEntregar > 0 ? `${porEntregar} por atender` : 'Tudo atendido'}
                    </span>
                    {conta && <span className="text-muted">Último: {formatarHora(conta.ultimoPedido)}</span>}
                  </div>
                ) : (
                  <span className="mt-auto pt-3 text-sm font-medium text-basil-600">Livre</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
