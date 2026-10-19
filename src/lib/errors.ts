/** Mensagem legível em português a partir de um erro do Supabase ou da rede. */
export function mensagemDeErro(erro: unknown): string {
  if (!erro) return 'Ocorreu um erro. Tente de novo.'
  const e = erro as { message?: string; code?: string; hint?: string }
  // As funções da base levantam mensagens já em português (errcode P0001).
  if (e.code === 'P0001' && e.message) return e.message
  const msg = e.message ?? String(erro)
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(msg)) {
    return 'Sem ligação à internet. Verifique a rede e tente de novo.'
  }
  if (/Invalid login credentials/i.test(msg)) return 'Email ou senha errados.'
  if (/Email not confirmed/i.test(msg)) return 'O email ainda não foi confirmado.'
  if (/row-level security|permission denied/i.test(msg)) return 'Sem permissão para esta ação.'
  if (/violates foreign key constraint/i.test(msg)) return 'Não é possível apagar: há registos ligados a este item.'
  if (/duplicate key/i.test(msg)) return 'Já existe um registo com estes dados.'
  return 'Ocorreu um erro. Tente de novo.'
}
