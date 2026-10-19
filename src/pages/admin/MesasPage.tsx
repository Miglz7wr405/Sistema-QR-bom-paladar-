import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useRealtime } from '../../components/admin/AdminLayout'
import { CartaoPedido } from '../../components/admin/CartaoPedido'
import { Aviso, Spinner, Vazio } from '../../components/ui/Ui'
import { mensagemDeErro } from '../../lib/errors'
import { formatarHora, formatarPreco, porAtender } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { EstadoPedido, Pedido } from '../../lib/types'

interface ResumoMesa {
  id: string
  numero: number
  nome: string
  ocupada: boolean
  porEntregar: number
  totalAberto: number
  ultimoPedido: string | null
}

export function MesasPage() {
  const { versao, mesasNovas } = useRealtime()
  const [mesas, setMesas] = useState<ResumoMesa[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendentes, setPendentes] = useState<Pedido[]>([])
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const [m, s] = await Promise.all([
        supabase.from('restaurant_tables').select('id, numero, nome').eq('ativa', true).order('numero'),
        supabase.from('table_sessions').select('id, table_id').is('fechada_em', null),
      ])
      if (m.error || s.error) throw m.error ?? s.error
      const sessoes = s.data.map((x) => x.id)
      const p = sessoes.length
        ? await supabase.from('orders').select('*, order_items(*)').in('session_id', sessoes).order('criado_em')
        : { data: [] as Pedido[], error: null }
      if (p.error) throw p.error
      const lista = (p.data ?? []) as Pedido[]
      const resumo = m.data.map((mesa) => {
        const pedidos = lista.filter((x) => x.table_id === mesa.id)
        const validos = pedidos.filter((x) => x.estado !== 'cancelado')
        return {
          ...mesa,
          ocupada: s.data.some((x) => x.table_id === mesa.id),
          porEntregar: pedidos.filter((x) => porAtender(x.estado)).length,
          totalAberto: validos.reduce((soma, x) => soma + Number(x.total), 0),
          ultimoPedido: pedidos.map((x) => x.criado_em).sort().at(-1) ?? null,
        }
      })
      if (ativo) {
        setMesas(resumo)
        setPendentes(lista.filter((x) => porAtender(x.estado)))
        setErro(null)
      }
    }
    carregar().catch((e) => ativo && setErro(mensagemDeErro(e)))
    return () => {
      ativo = false
    }
  }, [versao])

  // "✓ Atendido" no painel: o pedido sai logo da lista (continua no detalhe da mesa 20 min e no Histórico).
  async function mudarEstado(pedido: Pedido, estado: EstadoPedido) {
    setOcupado(true)
    const { error } = await supabase.from('orders').update({ estado }).eq('id', pedido.id)
    setOcupado(false)
    if (error) return setErro(mensagemDeErro(error))
    setPendentes((l) => l.filter((x) => x.id !== pedido.id))
    setMesas((ms) => ms?.map((m) => (m.id === pedido.table_id ? { ...m, porEntregar: Math.max(0, m.porEntregar - 1) } : m)) ?? null)
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

  const ocupadas = mesas.filter((m) => m.ocupada).length
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <h1 className="font-display text-2xl">Painel</h1>
        <p className="text-sm text-muted">
          {ocupadas} ocupada{ocupadas === 1 ? '' : 's'} de {mesas.length} · total em aberto{' '}
          <strong className="text-ink-900">{formatarPreco(mesas.reduce((s, m) => s + m.totalAberto, 0))}</strong>
        </p>
      </div>
      {erro && (
        <div className="mb-4">
          <Aviso>{erro}</Aviso>
        </div>
      )}
      <section aria-labelledby="por-atender" className="mb-8">
        <h2 id="por-atender" className="mb-3 font-display text-xl">
          Por atender {pendentes.length > 0 && <span className="rounded-full bg-ember-500 px-2 text-base text-white">{pendentes.length}</span>}
        </h2>
        {pendentes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-cream-200 px-4 py-5 text-center text-muted">✓ Nada por atender. Os pedidos novos aparecem aqui na hora.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pendentes.map((p) => (
              <CartaoPedido
                key={p.id}
                pedido={p}
                mesaNome={mesas.find((m) => m.id === p.table_id)?.nome ?? 'Mesa'}
                ocupado={ocupado}
                aoMudarEstado={(e) => void mudarEstado(p, e)}
              />
            ))}
          </div>
        )}
      </section>

      <h2 className="mb-3 font-display text-xl">Mesas</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {mesas.map((m) => {
          const nova = mesasNovas.has(m.id)
          return (
            <li key={m.id}>
              <Link
                to={`/admin/mesas/${m.id}`}
                className={`flex h-full min-h-36 flex-col rounded-2xl border-2 p-4 transition hover:-translate-y-0.5 hover:shadow-lg ${
                  nova
                    ? 'animate-pulse border-ember-500 bg-ember-500/10'
                    : m.ocupada
                      ? 'border-gold-500 bg-white'
                      : 'border-cream-200 bg-cream-100/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-display text-2xl">{m.nome}</span>
                  {nova && <span className="rounded-full bg-ember-500 px-2 py-0.5 text-xs font-bold text-white">NOVO</span>}
                </div>
                {m.ocupada ? (
                  <div className="mt-auto flex flex-col gap-0.5 pt-3 text-sm">
                    <span className="text-lg font-semibold tabular-nums text-ink-900">{formatarPreco(m.totalAberto)}</span>
                    <span className={m.porEntregar > 0 ? 'font-semibold text-ember-600' : 'text-muted'}>
                      {m.porEntregar > 0 ? `${m.porEntregar} por atender` : 'Tudo atendido'}
                    </span>
                    {m.ultimoPedido && <span className="text-muted">Último: {formatarHora(m.ultimoPedido)}</span>}
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
