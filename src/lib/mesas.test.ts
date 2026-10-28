import { describe, expect, it } from 'vitest'
import { agruparPorMesa, textoFecharMesa } from './mesas'
import type { EstadoPedido, Pedido } from './types'

const sessao = (id: string, mesa: string) => ({ id, table_id: mesa, aberta_em: '2026-10-28T16:00:00Z' })

function pedido(id: string, sessaoId: string, hora: string, total: number, estado: EstadoPedido = 'recebido'): Pedido {
  return {
    id,
    session_id: sessaoId,
    table_id: 'mesa',
    estado,
    nota_geral: null,
    total,
    criado_em: `2026-10-28T${hora}:00Z`,
    atualizado_em: `2026-10-28T${hora}:00Z`,
  }
}

describe('agruparPorMesa', () => {
  it('junta os pedidos da mesma mesa num só bloco, por ordem de chegada, com o total da conta', () => {
    const [conta, ...resto] = agruparPorMesa(
      [sessao('s5', 'm5')],
      [pedido('caipirosca', 's5', '16:40', 300), pedido('massa', 's5', '16:26', 21250, 'entregue')],
    )
    expect(resto).toEqual([])
    expect(conta!.pedidos.map((p) => p.id)).toEqual(['massa', 'caipirosca'])
    expect(conta!.total).toBe(21550)
    expect(conta!.porAtender).toBe(1)
    expect(conta!.ultimoPedido).toBe('2026-10-28T16:40:00Z')
  })

  it('os pedidos cancelados não contam para o total', () => {
    const [conta] = agruparPorMesa([sessao('s1', 'm1')], [pedido('a', 's1', '16:00', 500), pedido('b', 's1', '16:05', 800, 'cancelado')])
    expect(conta!.total).toBe(500)
    expect(conta!.pedidos).toHaveLength(2)
  })

  it('mesas com pedidos por atender ficam em cima, a mais recente primeiro; depois as que têm tudo atendido', () => {
    const contas = agruparPorMesa(
      [sessao('atendida', 'm1'), sessao('antiga', 'm2'), sessao('recente', 'm3'), sessao('vazia', 'm4')],
      [
        pedido('a', 'atendida', '16:50', 100, 'entregue'),
        pedido('b', 'antiga', '16:10', 100),
        pedido('c', 'recente', '16:30', 100),
      ],
    )
    expect(contas.map((c) => c.sessao.id)).toEqual(['recente', 'antiga', 'atendida'])
  })

  it('pedidos de outra sessão (cliente anterior da mesma mesa) não entram na conta', () => {
    const [conta] = agruparPorMesa([sessao('nova', 'm5')], [pedido('velho', 'fechada', '12:00', 900), pedido('novo', 'nova', '16:00', 300)])
    expect(conta!.pedidos.map((p) => p.id)).toEqual(['novo'])
    expect(conta!.total).toBe(300)
  })
})

describe('textoFecharMesa', () => {
  it('avisa quando ainda há pedidos por atender', () => {
    expect(textoFecharMesa(2)).toMatch(/2 pedido\(s\) por atender/)
    expect(textoFecharMesa(0)).toMatch(/A conta foi paga/)
  })
})
