import { describe, expect, it } from 'vitest'
import { estadoCozinha, minutosDeEspera, pedidoFaladoDoTalao } from './cozinha'
import { pedacosDoPedido } from './frase'
import type { ItemPedido, TalaoCozinha } from './types'

const item = (para_cozinha: boolean): ItemPedido => ({
  id: 'i',
  order_id: 'o',
  menu_item_id: null,
  nome: 'Massa Bolonhesa',
  opcao: null,
  preco_unitario: 850,
  quantidade: 1,
  nota: null,
  para_cozinha,
})

describe('estadoCozinha', () => {
  const comComida = { estado: 'recebido' as const, cozinha_inicio_em: null, cozinha_pronto_em: null, order_items: [item(true), item(false)] }

  it('Na cozinha → A preparar → Pronto', () => {
    expect(estadoCozinha(comComida)).toBe('na_cozinha')
    expect(estadoCozinha({ ...comComida, estado: 'em_preparacao', cozinha_inicio_em: '2026-10-28T16:00:00Z' })).toBe('a_preparar')
    expect(estadoCozinha({ ...comComida, cozinha_inicio_em: '2026-10-28T16:00:00Z', cozinha_pronto_em: '2026-10-28T16:10:00Z' })).toBe('pronto')
  })

  it('não aparece em pedidos só de bebidas, cancelados ou já atendidos', () => {
    expect(estadoCozinha({ ...comComida, order_items: [item(false)] })).toBeNull()
    expect(estadoCozinha({ ...comComida, estado: 'cancelado' })).toBeNull()
    expect(estadoCozinha({ ...comComida, estado: 'entregue', cozinha_pronto_em: '2026-10-28T16:10:00Z' })).toBeNull()
  })
})

describe('minutosDeEspera', () => {
  it('conta minutos inteiros e nunca dá negativo', () => {
    const agora = new Date('2026-10-28T16:25:30Z').getTime()
    expect(minutosDeEspera('2026-10-28T16:00:00Z', agora)).toBe(25)
    expect(minutosDeEspera('2026-10-28T16:30:00Z', agora)).toBe(0)
  })
})

describe('voz da cozinha', () => {
  it('lê só a comida do talão', () => {
    const talao: TalaoCozinha = {
      id: 't',
      mesa: 'Mesa 1',
      estado: 'recebido',
      nota_geral: null,
      criado_em: '2026-10-28T16:00:00Z',
      cozinha_inicio_em: null,
      itens: [{ nome: 'Massa Bolonhesa', opcao: null, quantidade: 2, nota: null }],
    }
    const p = pedidoFaladoDoTalao(talao)
    const gravados = new Set(['mesa 1 pediu', 'n2f', 'massa bolonhesa'])
    expect(pedacosDoPedido(p.mesaNome, p.itens, p.notaGeral, (c) => gravados.has(c))).toEqual(['mesa 1 pediu', 'n2f', 'massa bolonhesa'])
  })
})
