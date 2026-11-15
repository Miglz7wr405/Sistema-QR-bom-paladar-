// Tarefa diária do Vercel (vercel.json → crons): faz um pedido leve à base de dados para o Supabase
// não desligar o projeto por falta de uso (o plano gratuito pausa-o ao fim de ~7 dias sem pedidos).
const URL_SUPABASE = process.env.VITE_SUPABASE_URL || 'https://zvxownsxaaznyqdqzhgc.supabase.co'
const CHAVE = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_g70RiuIP-WcXZLYEKz2L5Q_4-qMCMfU'

export default async function handler(_req: unknown, res: { status: (n: number) => { send: (t: string) => void } }) {
  try {
    const r = await fetch(`${URL_SUPABASE}/rest/v1/categories?select=id&limit=1`, { headers: { apikey: CHAVE } })
    res.status(r.ok ? 200 : 502).send(r.ok ? 'ok' : `Supabase respondeu ${r.status}`)
  } catch (e) {
    res.status(502).send(`Sem resposta do Supabase: ${String(e)}`)
  }
}
