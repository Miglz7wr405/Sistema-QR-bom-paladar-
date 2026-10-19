import { formatarDataHora, formatarHora, formatarPreco, PROXIMO_ESTADO, ESTADOS } from '../../lib/format'
import type { EstadoPedido, Pedido } from '../../lib/types'
import { EstadoBadge } from '../cliente/EstadoBadge'

interface Props {
  pedido: Pedido
  mesaNome?: string
  comData?: boolean
  aoMudarEstado?: (estado: EstadoPedido) => void
  ocupado?: boolean
}

export function CartaoPedido({ pedido, mesaNome, comData, aoMudarEstado, ocupado }: Props) {
  const proximo = PROXIMO_ESTADO[pedido.estado]
  const podeCancelar = pedido.estado === 'recebido' || pedido.estado === 'em_preparacao'
  return (
    <article className={`cartao p-4 ${pedido.estado === 'cancelado' ? 'opacity-60' : ''} ${pedido.estado === 'recebido' ? 'ring-2 ring-gold-400' : ''}`}>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {mesaNome && <span className="rounded-lg bg-ink-900 px-2 py-0.5 font-display text-gold-300">{mesaNome}</span>}
          <span className="font-semibold">{comData ? formatarDataHora(pedido.criado_em) : formatarHora(pedido.criado_em)}</span>
        </div>
        <EstadoBadge estado={pedido.estado} />
      </header>

      <ul className="flex flex-col gap-1.5">
        {(pedido.order_items ?? []).map((i) => (
          <li key={i.id} className="flex justify-between gap-3">
            <span>
              <strong className="tabular-nums">{i.quantidade}×</strong> {i.nome}
              {i.opcao && <span className="font-semibold text-ink-800"> · {i.opcao}</span>}
              {i.nota && <span className="mt-0.5 block rounded-md bg-gold-200/60 px-2 py-0.5 text-sm font-semibold text-ember-600">Nota: {i.nota}</span>}
            </span>
            <span className="shrink-0 tabular-nums text-muted">{formatarPreco(Number(i.preco_unitario) * i.quantidade)}</span>
          </li>
        ))}
      </ul>

      {pedido.nota_geral && (
        <p className="mt-3 rounded-lg bg-gold-200/60 px-3 py-2 text-sm font-semibold text-ember-600">Nota do pedido: {pedido.nota_geral}</p>
      )}

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-cream-200 pt-3">
        <span className="text-lg font-semibold tabular-nums">{formatarPreco(Number(pedido.total))}</span>
        {aoMudarEstado && (
          <div className="flex flex-wrap gap-2">
            {podeCancelar && (
              <button
                type="button"
                className="btn-secundario min-h-10 text-ember-600"
                disabled={ocupado}
                onClick={() => window.confirm('Cancelar este pedido?') && aoMudarEstado('cancelado')}
              >
                Cancelar
              </button>
            )}
            {proximo && (
              <button type="button" className="btn-primario min-h-10" disabled={ocupado} onClick={() => aoMudarEstado(proximo)}>
                Marcar “{ESTADOS[proximo].rotulo}”
              </button>
            )}
          </div>
        )}
      </footer>
    </article>
  )
}
