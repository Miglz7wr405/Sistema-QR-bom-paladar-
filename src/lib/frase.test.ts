import { describe, expect, it } from 'vitest'
import { chaveVoz, pedacosComecou, pedacosDoPedido, pedacosPronto, resumoDoPedido, type ItemFalado } from './frase'

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

  it('notas comuns gravadas: lidas na voz Dinis', () => {
    const comNotas = new Set([...gravados, 'nota', 'nota para', 'nota do pedido', 'sem gelo', 'sem cebola', 'sem alho', 'bebidas primeiro'])
    const tem = (c: string) => comNotas.has(c)
    expect(pedacosDoPedido('Mesa 1', [item('Mojito', 1, null, 'Sem gelo!')], null, tem)).toEqual(['mesa 1 pediu', 'mojito', 'nota para', 'mojito', 'sem gelo'])
    expect(pedacosDoPedido('Mesa 1', [item('Mojito', 1, null, 's/ cebola, sem alho e sem gelo')], null, tem)).toEqual([
      'mesa 1 pediu', 'mojito', 'nota para', 'mojito', 'sem cebola', 'sem alho', 'e', 'sem gelo',
    ])
    expect(pedacosDoPedido('Mesa 1', [item('Mojito')], 'Bebidas primeiro.', tem)).toEqual(['mesa 1 pediu', 'mojito', 'nota do pedido', 'bebidas primeiro'])
    // Prato sem gravação: "Nota: sem gelo".
    expect(pedacosDoPedido('Mesa 1', [item('Prato novo', 1, null, 'sem gelo')], null, tem)).toEqual(['mesa 1 pediu', 'e mais itens veja no ecra', 'nota', 'sem gelo'])
    // Uma parte por gravar: a nota não é lida, diz-se "Com nota, veja no ecrã".
    expect(pedacosDoPedido('Mesa 1', [item('Mojito', 1, null, 'sem gelo e com duas rodelas')], null, tem)).toEqual(['mesa 1 pediu', 'mojito', 'com nota veja no ecra'])
  })

  it('notas: "Com nota, veja no ecrã"', () => {
    expect(pedacosDoPedido('Mesa 1', [item('Mojito', 1, null, 'sem gelo')], null, temAudio).at(-1)).toBe('com nota veja no ecra')
    expect(pedacosDoPedido('Mesa 1', [item('Mojito')], 'bebidas primeiro', temAudio).at(-1)).toBe('com nota veja no ecra')
  })

  it('sem áudio: prato novo, mesa nova ou quantidade alta', () => {
    expect(pedacosDoPedido('Mesa 1', [item('Prato novo'), item('Mojito')], null, temAudio)).toEqual(['mesa 1 pediu', 'mojito', 'e mais itens veja no ecra'])
    expect(pedacosDoPedido('Esplanada', [item('Mojito')], null, temAudio)).toEqual(['novo pedido', 'mojito'])
    expect(pedacosDoPedido('Mesa 1', [item('Mojito', 120)], null, temAudio)).toEqual(['mesa 1 pediu', 'e mais itens veja no ecra'])
    // 25 sem os pedaços "vinte" e "cinco" gravados.
    expect(pedacosDoPedido('Mesa 1', [item('Mojito', 25)], null, temAudio)).toEqual(['mesa 1 pediu', 'e mais itens veja no ecra'])
  })

  it('quantidades de 21 a 99: "vinte e cinco", "vinte e uma", "noventa e nove"', () => {
    const numeros = new Set([...gravados, 'n1', 'n1f', 'n5', 'n9', 'n20', 'n30', 'n90', 'massa fettuccine', 'caipirosca'])
    const tem = (c: string) => numeros.has(c)
    expect(pedacosDoPedido('Mesa 1', [item('Massa Fettuccine', 25), item('Caipirosca')], null, tem)).toEqual([
      'mesa 1 pediu', 'n20', 'e', 'n5', 'massa fettuccine', 'e', 'caipirosca',
    ])
    expect(pedacosDoPedido('Mesa 1', [item('Massa Bolonhesa', 21)], null, tem)).toEqual(['mesa 1 pediu', 'n20', 'e', 'n1f', 'massa bolonhesa'])
    expect(pedacosDoPedido('Mesa 1', [item('Mojito', 21)], null, tem)).toEqual(['mesa 1 pediu', 'n20', 'e', 'n1', 'mojito'])
    expect(pedacosDoPedido('Mesa 1', [item('Massa Bolonhesa', 22)], null, tem)).toEqual(['mesa 1 pediu', 'n20', 'e', 'n2f', 'massa bolonhesa'])
    expect(pedacosDoPedido('Mesa 1', [item('Mojito', 30)], null, tem)).toEqual(['mesa 1 pediu', 'n30', 'mojito'])
    expect(pedacosDoPedido('Mesa 1', [item('Mojito', 99)], null, tem)).toEqual(['mesa 1 pediu', 'n90', 'e', 'n9', 'mojito'])
    expect(pedacosDoPedido('Mesa 1', [item('Buffet 2.000', 21)], null, tem)).toEqual(['mesa 1 pediu', 'buffet 2 000', 'para', 'n20', 'e', 'n1f', 'pessoas'])
  })

  const avisos = new Set([
    ...gravados,
    'mesa 9 a cozinha esta a preparar',
    'a cozinha esta a preparar',
    'mesa 9 a cozinha terminou de fazer',
    'a cozinha terminou de fazer',
    'pode levar a mesa',
  ])
  const temAviso = (c: string) => avisos.has(c)

  it('cozinha começou: "Mesa 9, a cozinha está a preparar: duas Massa Bolonhesa"', () => {
    expect(pedacosComecou('Mesa 9', [item('Massa Bolonhesa', 2)], temAviso)).toEqual(['mesa 9 a cozinha esta a preparar', 'n2f', 'massa bolonhesa'])
    expect(pedacosComecou('Esplanada', [item('Massa Bolonhesa')], temAviso)).toEqual(['a cozinha esta a preparar', 'massa bolonhesa'])
    expect(pedacosComecou('Mesa 9', [], () => false)).toEqual([])
  })

  it('cozinha pronto: "Mesa 9, a cozinha terminou de fazer: duas Massa Bolonhesa. Pode levar à mesa."', () => {
    expect(pedacosPronto('Mesa 9', [item('Massa Bolonhesa', 2), item('Arroz', 1, 'Arroz de coco')], temAviso)).toEqual([
      'mesa 9 a cozinha terminou de fazer', 'n2f', 'massa bolonhesa', 'e', 'arroz de coco', 'pode levar a mesa',
    ])
    expect(pedacosPronto('Esplanada', [item('Prato novo')], temAviso)).toEqual(['a cozinha terminou de fazer', 'e mais itens veja no ecra', 'pode levar a mesa'])
    expect(pedacosPronto('Mesa 9', [], temAviso)).toEqual(['mesa 9 a cozinha terminou de fazer', 'pode levar a mesa'])
  })

  it('resumo para o ecrã', () => {
    expect(resumoDoPedido([item('Massa Bolonhesa', 2), item('Cerveja nacional', 1, 'Txilar')])).toBe('2× Massa Bolonhesa · Cerveja nacional (Txilar)')
  })
})
