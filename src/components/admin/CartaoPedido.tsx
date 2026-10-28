import { formatarDataHora, formatarHora, formatarPreco, porAtender } from '../../lib/format'
import type { EstadoPedido, Pedido } from '../../lib/types'
import { EstadoBadge } from '../cliente/EstadoBadge'
import { useRealtime } from './AdminLayout'

interface Props {
  pedido: Pedido
  mesaNome?: string
  comData?: boolean
  aoMudarEstado?: (estado: EstadoPedido) => void
  ocupado?: boolean
}

/** Itens do pedido com preço, notas de cada item e a nota do pedido. */
export function ItensDoPedido({ pedido }: { pedido: Pedido }) {
  return (
    <>
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
    </>
  )
}

/** Ler de novo, Cancelar e ✓ Atendido de um pedido por atender. */
export function AcoesPedido({ pedido, aoMudarEstado, ocupado }: { pedido: Pedido; aoMudarEstado: (estado: EstadoPedido) => void; ocupado?: boolean }) {
  const { lerDeNovo, aLer } = useRealtime()
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="btn-secundario min-h-10 px-3"
        onClick={() => lerDeNovo(pedido.id)}
        aria-label="Ler o pedido em voz alta outra vez"
        title="Ler de novo"
      >
        {aLer === pedido.id ? '🔊 A ler…' : '🔊 Ler de novo'}
      </button>
      <button
        type="button"
        className="btn-secundario min-h-10 text-ember-600"
        disabled={ocupado}
        onClick={() => window.confirm('Cancelar este pedido?') && aoMudarEstado('cancelado')}
      >
        Cancelar
      </button>
      <button type="button" className="btn min-h-11 bg-basil-500 px-5 text-base text-white hover:bg-basil-600" disabled={ocupado} onClick={() => aoMudarEstado('entregue')}>
        ✓ Atendido
      </button>
    </div>
  )
}

export function CartaoPedido({ pedido, mesaNome, comData, aoMudarEstado, ocupado }: Props) {
  const pendente = porAtender(pedido.estado)
  const { aLer } = useRealtime()
  return (
    <article
      className={`cartao p-4 ${pedido.estado === 'cancelado' ? 'opacity-60' : ''} ${aLer === pedido.id ? 'ring-4 ring-ember-500' : pedido.estado === 'recebido' ? 'ring-2 ring-gold-400' : ''}`}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {mesaNome && <span className="rounded-lg bg-ink-900 px-2 py-0.5 font-display text-gold-300">{mesaNome}</span>}
          <span className="font-semibold">{comData ? formatarDataHora(pedido.criado_em) : formatarHora(pedido.criado_em)}</span>
        </div>
        <EstadoBadge estado={pedido.estado} />
      </header>

      <ItensDoPedido pedido={pedido} />

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-cream-200 pt-3">
        <span className="text-lg font-semibold tabular-nums">{formatarPreco(Number(pedido.total))}</span>
        {aoMudarEstado && pendente && <AcoesPedido pedido={pedido} aoMudarEstado={aoMudarEstado} ocupado={ocupado} />}
      </footer>
    </article>
  )
}
