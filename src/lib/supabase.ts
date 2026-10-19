import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configurado = Boolean(url && chave)

// Sem chaves, o cliente aponta para um endereço inválido e a App mostra o aviso de configuração.
export const supabase = createClient(url || 'http://localhost', chave || 'sem-chave', {
  auth: { persistSession: true, autoRefreshToken: true },
})

export const SITE_URL = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/+$/, '')

export function linkDaMesa(token: string): string {
  return `${SITE_URL}/m/${token}`
}
