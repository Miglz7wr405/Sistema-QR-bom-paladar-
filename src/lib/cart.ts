import type { Prato } from './types'

export interface LinhaCarrinho {
  /** Identifica a linha: o mesmo prato com opção ou nota diferente fica numa linha à parte. */
  chave: string
  prato: Pick<Prato, 'id' | 'nome' | 'preco' | 'unidade'>
  opcao: string | null
  nota: string
  quantidade: number
}

export const QTD_MAX = 99

export function chaveLinha(pratoId: string, opcao: string | null, nota: string): string {
  return `${pratoId}|${opcao ?? ''}|${nota.trim().toLowerCase()}`
}

export type AcaoCarrinho =
  | { tipo: 'adicionar'; prato: LinhaCarrinho['prato']; opcao: string | null; nota: string; quantidade: number }
  | { tipo: 'quantidade'; chave: string; quantidade: number }
  | { tipo: 'nota'; chave: string; nota: string }
  | { tipo: 'remover'; chave: string }
  | { tipo: 'esvaziar' }

const limitar = (n: number) => Math.max(1, Math.min(QTD_MAX, Math.floor(n)))

export function carrinhoReducer(linhas: LinhaCarrinho[], acao: AcaoCarrinho): LinhaCarrinho[] {
  switch (acao.tipo) {
    case 'adicionar': {
      const nota = acao.nota.trim()
      const chave = chaveLinha(acao.prato.id, acao.opcao, nota)
      const existente = linhas.find((l) => l.chave === chave)
      if (existente) {
        return linhas.map((l) => (l.chave === chave ? { ...l, quantidade: limitar(l.quantidade + acao.quantidade) } : l))
      }
      return [...linhas, { chave, prato: acao.prato, opcao: acao.opcao, nota, quantidade: limitar(acao.quantidade) }]
    }
    case 'quantidade':
      if (acao.quantidade < 1) return linhas.filter((l) => l.chave !== acao.chave)
      return linhas.map((l) => (l.chave === acao.chave ? { ...l, quantidade: limitar(acao.quantidade) } : l))
    case 'nota': {
      // A nota faz parte da chave: se ficar igual à de outra linha do mesmo prato, juntam-se.
      const linha = linhas.find((l) => l.chave === acao.chave)
      if (!linha) return linhas
      const nota = acao.nota.slice(0, 200)
      const chave = chaveLinha(linha.prato.id, linha.opcao, nota)
      if (chave === linha.chave) return linhas.map((l) => (l === linha ? { ...l, nota } : l))
      const outra = linhas.find((l) => l.chave === chave)
      if (outra) {
        return linhas
          .filter((l) => l !== linha)
          .map((l) => (l === outra ? { ...l, quantidade: limitar(l.quantidade + linha.quantidade) } : l))
      }
      return linhas.map((l) => (l === linha ? { ...l, nota, chave } : l))
    }
    case 'remover':
      return linhas.filter((l) => l.chave !== acao.chave)
    case 'esvaziar':
      return []
  }
}

export function totalCarrinho(linhas: LinhaCarrinho[]): number {
  return linhas.reduce((soma, l) => soma + l.prato.preco * l.quantidade, 0)
}

/** Quantas unidades de um prato já estão no pedido (somando opções e notas). */
export function quantidadeDoPrato(linhas: LinhaCarrinho[], pratoId: string): number {
  return linhas.filter((l) => l.prato.id === pratoId).reduce((soma, l) => soma + l.quantidade, 0)
}

export function contarItens(linhas: LinhaCarrinho[]): number {
  return linhas.reduce((soma, l) => soma + l.quantidade, 0)
}

/** O que vai para create_order: só ids, quantidades, notas e opções. O preço é sempre o da base. */
export function paraPedido(linhas: LinhaCarrinho[]) {
  return linhas.map((l) => ({
    menu_item_id: l.prato.id,
    quantidade: l.quantidade,
    nota: l.nota.trim() || null,
    opcao: l.opcao,
  }))
}
