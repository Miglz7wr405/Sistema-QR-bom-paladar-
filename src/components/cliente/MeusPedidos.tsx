import { formatarHora, formatarPreco, JANELA_MINUTOS } from '../../lib/format'
import type { PedidoCliente } from '../../lib/types'
import { Spinner, Vazio } from '../ui/Ui'
import { EstadoBadge } from './EstadoBadge'

interface Props {
  pedidos: PedidoCliente[] | null
  aoVerCardapio: () => void
}

export function MeusPedidos({ pedidos, aoVerCardapio }: Props) {
  if (pedidos === null) return <Spinner rotulo="A carregar os pedidos…" />
  if (pedidos.length === 0) {
    return (
      <Vazio titulo="Sem pedidos recentes" texto={`Os pedidos desta mesa aparecem aqui durante ${JANELA_MINUTOS} minutos, com o estado de cada um.`}>
        <button type="button" className="btn-primario mt-3" onClick={aoVerCardapio}>
          Ver o cardápio
        </button>
      </Vazio>
    )
  }

  const total = pedidos.filter((p) => p.estado !== 'cancelado').reduce((s, p) => s + p.total, 0)

  return (
    <div className="flex flex-col gap-3 pt-4">
      <p className="text-sm text-muted">Pedidos dos últimos {JANELA_MINUTOS} minutos. Atualiza sozinho.</p>
      {pedidos.map((p) => (
        <article key={p.id} className={`cartao p-4 ${p.estado === 'cancelado' ? 'opacity-60' : ''}`}>
          <header className="mb-2 flex items-center justify-between gap-2">
            <span className="font-semibold">Pedido das {formatarHora(p.criado_em)}</span>
            <EstadoBadge estado={p.estado} />
          </header>
          <ul className="flex flex-col gap-1 text-sm">
            {p.itens.map((i, n) => (
              <li key={n} className="flex justify-between gap-3">
                <span>
                  {i.quantidade}× {i.nome}
                  {i.opcao && <span className="text-muted"> · {i.opcao}</span>}
                  {i.nota && <span className="block italic text-ember-600">“{i.nota}”</span>}
                </span>
                <span className="shrink-0 tabular-nums">{formatarPreco(i.preco_unitario * i.quantidade)}</span>
              </li>
            ))}
          </ul>
          {p.nota_geral && <p className="mt-2 text-sm italic text-ember-600">Nota: “{p.nota_geral}”</p>}
          <p className="mt-2 border-t border-cream-200 pt-2 text-right font-semibold tabular-nums">{formatarPreco(p.total)}</p>
        </article>
      ))}
      <div className="flex items-center justify-between rounded-2xl bg-ink-900 px-4 py-3 text-cream-50">
        <span>Total destes pedidos</span>
        <span className="font-display text-xl text-gold-300 tabular-nums">{formatarPreco(total)}</span>
      </div>
      <p className="pb-4 text-center text-xs text-muted">Paga no fim, ao empregado ou no caixa.</p>
    </div>
  )
}
