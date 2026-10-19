import { createClient } from '@supabase/supabase-js'

// Valores do projeto Bom Paladar QR, para o deploy funcionar sem configurar variáveis.
// A chave é a publishable (pública por natureza; o acesso é controlado pelas regras da base).
// As variáveis de ambiente, se existirem, têm prioridade.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://zvxownsxaaznyqdqzhgc.supabase.co'
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_g70RiuIP-WcXZLYEKz2L5Q_4-qMCMfU'

export const configurado = Boolean(url && chave)

// Sem chaves, o cliente aponta para um endereço inválido e a App mostra o aviso de configuração.
export const supabase = createClient(url || 'http://localhost', chave || 'sem-chave', {
  auth: { persistSession: true, autoRefreshToken: true },
})

// Endereço que vai nos QR Codes impressos. Fixo no site oficial para os QR não dependerem do link
// por onde o painel foi aberto; em desenvolvimento (localhost) usa o próprio endereço.
const SITE_OFICIAL = 'https://sistema-qr-bom-paladar.vercel.app'
const emLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
export const SITE_URL = (import.meta.env.VITE_SITE_URL || (emLocal ? window.location.origin : SITE_OFICIAL)).replace(/\/+$/, '')

export function linkDaMesa(token: string): string {
  return `${SITE_URL}/m/${token}`
}
