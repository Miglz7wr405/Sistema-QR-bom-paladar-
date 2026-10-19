import { describe, expect, it } from 'vitest'
import { carrinhoReducer, contarItens, paraPedido, quantidadeDoPrato, totalCarrinho, type LinhaCarrinho } from './cart'
import { formatarPreco, limitesDoDia } from './format'

const massa = { id: 'a', nome: 'Massa Bolonhesa', preco: 850, unidade: null }
const cerveja = { id: 'b', nome: 'Cerveja nacional', preco: 100, unidade: null }

function com(...acoes: Parameters<typeof carrinhoReducer>[1][]): LinhaCarrinho[] {
  return acoes.reduce(carrinhoReducer, [] as LinhaCarrinho[])
}

describe('carrinho', () => {
  it('junta o mesmo prato com a mesma nota numa linha', () => {
    const c = com(
      { tipo: 'adicionar', prato: massa, opcao: null, nota: 'sem queijo', quantidade: 1 },
      { tipo: 'adicionar', prato: massa, opcao: null, nota: ' Sem queijo ', quantidade: 2 },
    )
    expect(c).toHaveLength(1)
    expect(c[0]?.quantidade).toBe(3)
  })

  it('separa notas e opções diferentes', () => {
    const c = com(
      { tipo: 'adicionar', prato: massa, opcao: null, nota: '', quantidade: 1 },
      { tipo: 'adicionar', prato: massa, opcao: null, nota: 'picante', quantidade: 1 },
      { tipo: 'adicionar', prato: cerveja, opcao: 'Txilar', nota: '', quantidade: 1 },
      { tipo: 'adicionar', prato: cerveja, opcao: 'Manica (lata)', nota: '', quantidade: 2 },
    )
    expect(c).toHaveLength(4)
    expect(contarItens(c)).toBe(5)
    expect(totalCarrinho(c)).toBe(850 * 2 + 100 * 3)
  })

  it('limita a quantidade entre 1 e 99 e remove com 0', () => {
    let c = com({ tipo: 'adicionar', prato: massa, opcao: null, nota: '', quantidade: 150 })
    expect(c[0]?.quantidade).toBe(99)
    c = carrinhoReducer(c, { tipo: 'quantidade', chave: c[0]!.chave, quantidade: 0 })
    expect(c).toHaveLength(0)
  })

  it('a nota escreve-se no carrinho e junta linhas que ficam iguais', () => {
    let c = com(
      { tipo: 'adicionar', prato: massa, opcao: null, nota: '', quantidade: 1 },
      { tipo: 'adicionar', prato: massa, opcao: null, nota: 'sem queijo', quantidade: 2 },
    )
    c = carrinhoReducer(c, { tipo: 'nota', chave: c[0]!.chave, nota: 'picante' })
    expect(c).toHaveLength(2)
    expect(c[0]?.nota).toBe('picante')
    c = carrinhoReducer(c, { tipo: 'nota', chave: c[0]!.chave, nota: 'Sem queijo' })
    expect(c).toHaveLength(1)
    expect(c[0]?.quantidade).toBe(3)
    expect(quantidadeDoPrato(c, 'a')).toBe(3)
  })

  it('envia só ids, quantidades, notas e opções (nunca o preço)', () => {
    const c = com({ tipo: 'adicionar', prato: cerveja, opcao: 'Txilar', nota: ' gelada ', quantidade: 2 })
    expect(paraPedido(c)).toEqual([{ menu_item_id: 'b', quantidade: 2, nota: 'gelada', opcao: 'Txilar' }])
    expect(JSON.stringify(paraPedido(c))).not.toContain('preco')
  })
})

describe('formatação', () => {
  it('formata meticais', () => {
    expect(formatarPreco(1500)).toBe('1.500 MT')
    expect(formatarPreco(50)).toBe('50 MT')
    expect(formatarPreco(12345.5)).toBe('12.345,50 MT')
  })

  it('calcula o dia de Maputo em UTC', () => {
    expect(limitesDoDia('2026-10-19')).toEqual({ de: '2026-10-18T22:00:00.000Z', ate: '2026-10-19T22:00:00.000Z' })
  })
})
