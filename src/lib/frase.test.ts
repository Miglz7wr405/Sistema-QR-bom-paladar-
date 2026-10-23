import { describe, expect, it } from 'vitest'
import { chaveVoz, pedacosDoPedido, resumoDoPedido, type ItemFalado } from './frase'

// Pedaços gravados neste teste (no site, vêm de public/voz/indice.json).
const gravados = new Set([
  'mesa 1 pediu',
  'n2',
  'n2f',
  'n3',
  'e',
  'para',
  'pessoas',
  'para uma pessoa',
  'com nota veja no ecra',
  'e mais itens veja no ecra',
  'novo pedido',
  'massa bolonhesa',
  'mojito',
  'cerveja nacional',
  'txilar',
  'castle lite',
  'arroz de coco',
  'buffet 2 000',
  'caipirinha',
])
const temAudio = (c: string) => gravados.has(c)
const item = (nome: string, quantidade = 1, opcao: string | null = null, nota: string | null = null): ItemFalado => ({ nome, quantidade, opcao, nota })

describe('frase do pedido', () => {
  it('normaliza como o script Python', () => {
    expect(chaveVoz('Lasanha de Carne Moída')).toBe('lasanha de carne moida')
    expect(chaveVoz('Buffet 2.000')).toBe('buffet 2 000')
    expect(chaveVoz('Mesa 1 pediu')).toBe('mesa 1 pediu')
  })

  it('"Mesa 1 pediu dois Massa… e Mojito"; dois/duas pelo género', () => {
    expect(pedacosDoPedido('Mesa 1', [item('Massa Bolonhesa', 2), item('Mojito')], null, temAudio)).toEqual([
      'mesa 1 pediu',
      'n2f',
      'massa bolonhesa',
      'e',
      'mojito',
    ])
    expect(pedacosDoPedido('Mesa 1', [item('Mojito', 2)], null, temAudio)).toEqual(['mesa 1 pediu', 'n2', 'mojito'])
  })

  it('opções: diz nome + opção, ou só a opção quando ela já diz tudo', () => {
    expect(pedacosDoPedido('Mesa 1', [item('Cerveja nacional', 1, 'Txilar')], null, temAudio)).toEqual(['mesa 1 pediu', 'cerveja nacional', 'txilar'])
    expect(pedacosDoPedido('Mesa 1', [item('Super Bock ou Castle Lite', 3, 'Castle Lite')], null, temAudio)).toEqual(['mesa 1 pediu', 'n3', 'castle lite'])
    expect(pedacosDoPedido('Mesa 1', [item('Arroz', 1, 'Arroz de coco')], null, temAudio)).toEqual(['mesa 1 pediu', 'arroz de coco'])
  })

  it('buffet por pessoas', () => {
    expect(pedacosDoPedido('Mesa 1', [item('Buffet 2.000', 3)], null, temAudio)).toEqual(['mesa 1 pediu', 'buffet 2 000', 'para', 'n3', 'pessoas'])
    expect(pedacosDoPedido('Mesa 1', [item('Buffet 2.000', 1)], null, temAudio)).toEqual(['mesa 1 pediu', 'buffet 2 000', 'para uma pessoa'])
  })

  it('notas: "Com nota, veja no ecrã"', () => {
    expect(pedacosDoPedido('Mesa 1', [item('Mojito', 1, null, 'sem gelo')], null, temAudio).at(-1)).toBe('com nota veja no ecra')
    expect(pedacosDoPedido('Mesa 1', [item('Mojito')], 'bebidas primeiro', temAudio).at(-1)).toBe('com nota veja no ecra')
  })

  it('sem áudio: prato novo, mesa nova ou quantidade alta', () => {
    expect(pedacosDoPedido('Mesa 1', [item('Prato novo'), item('Mojito')], null, temAudio)).toEqual(['mesa 1 pediu', 'mojito', 'e mais itens veja no ecra'])
    expect(pedacosDoPedido('Esplanada', [item('Mojito')], null, temAudio)).toEqual(['novo pedido', 'mojito'])
    expect(pedacosDoPedido('Mesa 1', [item('Mojito', 25)], null, temAudio)).toEqual(['mesa 1 pediu', 'e mais itens veja no ecra'])
  })

  it('resumo para o ecrã', () => {
    expect(resumoDoPedido([item('Massa Bolonhesa', 2), item('Cerveja nacional', 1, 'Txilar')])).toBe('2× Massa Bolonhesa · Cerveja nacional (Txilar)')
  })
})
