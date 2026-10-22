import { describe, expect, it } from 'vitest'
import { juntarTexto } from './ditado'

describe('juntarTexto (ditado das notas)', () => {
  it('campo vazio: o que foi dito, com maiúscula', () => {
    expect(juntarTexto('', 'trazer as bebidas primeiro', 500)).toBe('Trazer as bebidas primeiro')
  })

  it('já havia texto: junta com um espaço', () => {
    expect(juntarTexto('Sem cebola', 'e pouco sal', 200)).toBe('Sem cebola e pouco sal')
    expect(juntarTexto('Sem cebola  ', ' e pouco sal ', 200)).toBe('Sem cebola e pouco sal')
  })

  it('nada dito: fica como estava', () => {
    expect(juntarTexto('Sem gelo', '  ', 200)).toBe('Sem gelo')
  })

  it('não passa do limite do campo', () => {
    expect(juntarTexto('abc', 'defghij', 6)).toBe('abc de')
  })
})
