import { useState } from 'react'
import { Link } from 'react-router-dom'
import { mensagemDeErro } from '../../lib/errors'
import { formatarHora, formatarPreco, porAtender } from '../../lib/format'
import { textoFecharMesa, type ContaMesa } from '../../lib/mesas'
import { supabase } from '../../lib/supabase'
import type { EstadoPedido, Pedido } from '../../lib/types'
import { EstadoBadge } from '../cliente/EstadoBadge'
import { useRealtime } from './AdminLayout'
import { AcoesPedido, ItensDoPedido } from './CartaoPedido'

interface Props {
  conta: ContaMesa
  mesaNome: string
  /** Mostra o link "Ver mesa" (no painel; no detalhe da mesa já se está lá). */
  comLink?: boolean
  ocupado?: boolean
  aoMudarEstado: (pedido: Pedido, estado: EstadoPedido) => void
  /** Chamado depois de a mesa ser fechada. */
  aoFechar: () => void
  aoErro: (mensagem: string) => void
}

/**
 * Um bloco por mesa: todos os pedidos da mesa desde que abriu (1.º pedido, 2.º pedido…), cada um com
 * os seus botões, e no fim o total da conta. Fica até carregarem em "Fechar mesa".
 */
export function BlocoMesa({ conta, mesaNome, comLink, ocupado, aoMudarEstado, aoFechar, aoErro }: Props) {
  const { aLer } = useRealtime()
  const [aFechar, setAFechar] = useState(false)
  const validos = conta.pedidos.filter((p) => p.estado !== 'cancelado').length

  async function fecharMesa() {
    if (!window.confirm(textoFecharMesa(conta.porAtender))) return
    setAFechar(true)
    const { error } = await supabase.from('table_sessions').update({ fechada_em: new Date().toISOString() }).eq('id', conta.sessao.id)
    setAFechar(false)
    if (error) return aoErro(mensagemDeErro(error))
    aoFechar()
  }

  return (
    <article className={`cartao overflow-hidden ${conta.porAtender > 0 ? 'ring-2 ring-gold-400' : ''}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-ink-900 px-2 py-0.5 font-display text-lg text-gold-300">{mesaNome}</span>
          <span className="text-sm text-muted">aberta às {formatarHora(conta.sessao.aberta_em)}</span>
        </div>
        {conta.porAtender > 0 ? (
          <span className="rounded-full bg-ember-500 px-2.5 py-0.5 text-sm font-bold text-white">{conta.porAtender} por atender</span>
        ) : (
          <span className="rounded-full bg-basil-500/10 px-2.5 py-0.5 text-sm font-semibold text-basil-600">✓ Tudo atendido</span>
        )}
      </header>

      <ol>
        {conta.pedidos.map((p, n) => {
          const pendente = porAtender(p.estado)
          // Subtotal só quando acrescenta alguma coisa: vários pedidos e vários itens neste pedido.
          const comSubtotal = conta.pedidos.length > 1 && (p.order_items?.length ?? 0) > 1
          return (
            <li
              key={p.id}
              className={`border-t border-dashed border-cream-200 px-4 py-3 ${
                aLer === p.id ? 'bg-ember-500/5 ring-4 ring-inset ring-ember-500' : pendente ? 'bg-gold-200/25' : ''
              } ${p.estado === 'cancelado' ? 'opacity-50 [&_ul]:line-through' : p.estado === 'entregue' ? 'opacity-60' : ''}`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {n + 1}.º pedido <span className="font-normal text-muted">· {formatarHora(p.criado_em)}</span>
                </span>
                <EstadoBadge estado={p.estado} />
              </div>
              <ItensDoPedido pedido={p} />
              {(comSubtotal || pendente) && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  {pendente ? <AcoesPedido pedido={p} ocupado={ocupado} aoMudarEstado={(e) => aoMudarEstado(p, e)} /> : <span />}
                  {comSubtotal && <span className="ml-auto text-sm tabular-nums text-muted">Subtotal {formatarPreco(Number(p.total))}</span>}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <footer className="flex flex-col gap-3 bg-ink-900 px-4 py-3 text-cream-50">
        <div className="flex items-baseline justify-between gap-3">
          <span>
            Conta da mesa <span className="text-sm text-cream-200/70">· {validos} pedido{validos === 1 ? '' : 's'}</span>
          </span>
          <span className="font-display text-2xl tabular-nums text-gold-300">{formatarPreco(conta.total)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          {comLink ? (
            <Link to={`/admin/mesas/${conta.sessao.table_id}`} className="text-sm text-cream-200 underline underline-offset-2 hover:text-cream-50">
              Ver mesa
            </Link>
          ) : (
            <span />
          )}
          <button type="button" className="btn-perigo min-h-10" disabled={ocupado || aFechar} onClick={() => void fecharMesa()}>
            {aFechar ? 'A fechar…' : 'Fechar mesa'}
          </button>
        </div>
      </footer>
    </article>
  )
}
