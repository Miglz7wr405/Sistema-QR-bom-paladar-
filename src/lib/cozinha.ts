import { porAtender } from './format'
import type { ItemFalado } from './frase'
import type { Pedido, TalaoCozinha } from './types'

// O ecrã da cozinha (/cozinha/<token>) e o estado da cozinha que a recepção vê no bloco da mesa.

/** A partir de quantos minutos à espera o talão fica a vermelho na cozinha. */
export const ESPERA_LONGA_MIN = 20

export type EstadoCozinha = 'na_cozinha' | 'a_preparar' | 'pronto'

export const ROTULO_COZINHA: Record<EstadoCozinha, string> = {
  na_cozinha: '🍳 Na cozinha',
  a_preparar: '🍳 A preparar',
  pronto: '🍳 Pronto, levar à mesa',
}

/**
 * O que a recepção vê da cozinha num pedido ainda por atender. null quando não interessa:
 * pedido sem comida, cancelado ou já atendido.
 */
export function estadoCozinha(pedido: Pick<Pedido, 'estado' | 'cozinha_inicio_em' | 'cozinha_pronto_em' | 'order_items'>): EstadoCozinha | null {
  if (!porAtender(pedido.estado)) return null
  if (!pedido.order_items?.some((i) => i.para_cozinha)) return null
  if (pedido.cozinha_pronto_em) return 'pronto'
  if (pedido.cozinha_inicio_em) return 'a_preparar'
  return 'na_cozinha'
}

/** Minutos desde que o pedido chegou (nunca negativo, mesmo com o relógio do aparelho adiantado). */
export function minutosDeEspera(criadoEm: string, agora = Date.now()): number {
  return Math.max(0, Math.floor((agora - new Date(criadoEm).getTime()) / 60_000))
}

/** O talão como a voz o lê na cozinha: "Mesa 5 pediu duas Massa Bolonhesa" (só a comida). */
export function pedidoFaladoDoTalao(t: TalaoCozinha): { id: string; mesaNome: string; notaGeral: string | null; itens: ItemFalado[] } {
  return { id: t.id, mesaNome: t.mesa, notaGeral: t.nota_geral, itens: t.itens }
}
