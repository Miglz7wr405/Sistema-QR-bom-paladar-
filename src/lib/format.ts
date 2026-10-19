import type { EstadoPedido } from './types'

export const FUSO = 'Africa/Maputo'

/** 1500 -> "1.500 MT" */
export function formatarPreco(valor: number): string {
  const arredondado = Math.round(Number(valor) * 100) / 100
  const [inteiro, decimais] = arredondado.toFixed(2).split('.') as [string, string]
  const comPontos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decimais === '00' ? `${comPontos} MT` : `${comPontos},${decimais} MT`
}

/** Como nos cartões do bar e dos vinhos: 1500 -> "1.500,00 MT" */
export function formatarPrecoImpresso(valor: number): string {
  const [inteiro, decimais] = (Math.round(Number(valor) * 100) / 100).toFixed(2).split('.') as [string, string]
  return `${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimais} MT`
}

/** Hora em Maputo, 24h: "14:05". */
export function formatarHora(iso: string): string {
  return new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: FUSO }).format(new Date(iso))
}

/** "19/10/2026 14:05" em Maputo. */
export function formatarDataHora(iso: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: FUSO,
  }).format(new Date(iso))
}

/** Data de hoje em Maputo no formato AAAA-MM-DD (para filtros). */
export function hojeEmMaputo(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora)
}

/** Início e fim (exclusivo) de um dia de Maputo em ISO UTC. Maputo é sempre UTC+2 (sem hora de verão). */
export function limitesDoDia(dia: string): { de: string; ate: string } {
  const inicio = new Date(`${dia}T00:00:00+02:00`)
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000)
  return { de: inicio.toISOString(), ate: fim.toISOString() }
}

export const ESTADOS: Record<EstadoPedido, { rotulo: string; classe: string }> = {
  recebido: { rotulo: 'Recebido', classe: 'bg-gold-200 text-ink-900' },
  em_preparacao: { rotulo: 'Em preparação', classe: 'bg-ember-500 text-white' },
  entregue: { rotulo: 'Atendido', classe: 'bg-basil-500 text-white' },
  cancelado: { rotulo: 'Cancelado', classe: 'bg-ink-600 text-white line-through' },
}

/** Pedidos atendidos (painel) e todos os pedidos (telemóvel do cliente) desaparecem da vista depois disto. */
export const JANELA_MINUTOS = 20

export function dentroDaJanela(iso: string, agora = Date.now()): boolean {
  return agora - new Date(iso).getTime() < JANELA_MINUTOS * 60 * 1000
}

export const porAtender = (estado: EstadoPedido) => estado === 'recebido' || estado === 'em_preparacao'
