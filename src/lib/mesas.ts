import { porAtender } from './format'
import type { Pedido, Sessao } from './types'

// A conta de cada mesa: todos os pedidos da sessão aberta (do primeiro pedido até "Fechar mesa").

export interface ContaMesa {
  sessao: Pick<Sessao, 'id' | 'table_id' | 'aberta_em'>
  /** Por ordem de chegada, como numa conta: 1.º pedido, 2.º pedido… */
  pedidos: Pedido[]
  porAtender: number
  /** Soma dos pedidos não cancelados. */
  total: number
  ultimoPedido: string
}

/**
 * Junta os pedidos por sessão (uma por mesa aberta) e ordena as contas: primeiro as mesas com pedidos
 * por atender, com a do pedido mais recente em cima; depois as mesas com tudo atendido.
 * Sessões sem pedidos ficam de fora.
 */
export function agruparPorMesa(sessoes: Pick<Sessao, 'id' | 'table_id' | 'aberta_em'>[], pedidos: Pedido[]): ContaMesa[] {
  const contas: ContaMesa[] = []
  for (const sessao of sessoes) {
    const daMesa = pedidos.filter((p) => p.session_id === sessao.id).sort((a, b) => a.criado_em.localeCompare(b.criado_em))
    if (daMesa.length === 0) continue
    contas.push({
      sessao,
      pedidos: daMesa,
      porAtender: daMesa.filter((p) => porAtender(p.estado)).length,
      total: daMesa.filter((p) => p.estado !== 'cancelado').reduce((s, p) => s + Number(p.total), 0),
      ultimoPedido: daMesa.at(-1)!.criado_em,
    })
  }
  return contas.sort((a, b) => Number(b.porAtender > 0) - Number(a.porAtender > 0) || b.ultimoPedido.localeCompare(a.ultimoPedido))
}

export function textoFecharMesa(pendentes: number): string {
  return pendentes > 0
    ? `Ainda há ${pendentes} pedido(s) por atender. Fechar a mesa mesmo assim?`
    : 'A conta foi paga? Fechar a mesa deixa-a livre para o próximo cliente.'
}
