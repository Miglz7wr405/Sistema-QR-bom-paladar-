import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { AssinaturaInsight, Aviso, Logo } from '../../components/ui/Ui'
import { useAuth } from '../../lib/auth'
import { mensagemDeErro } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

// Entra-se só com a palavra-passe: a conta de administrador é única e o email fica fixo.
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@bompaladar.co.mz'

const esquema = z.object({
  senha: z.string().min(6, 'A palavra-passe tem pelo menos 6 caracteres.'),
})

export function LoginPage() {
  const { sessao } = useAuth()
  const navigate = useNavigate()
  const de = (useLocation().state as { de?: string } | null)?.de ?? '/admin'
  const [senha, setSenha] = useState('')
  const [erroSenha, setErroSenha] = useState<string | undefined>()
  const [erro, setErro] = useState<string | null>(null)
  const [aEntrar, setAEntrar] = useState(false)

  if (sessao) return <Navigate to={de} replace />

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const r = esquema.safeParse({ senha })
    if (!r.success) return setErroSenha(r.error.issues[0]?.message)
    setErroSenha(undefined)
    setAEntrar(true)
    const { error } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: r.data.senha })
    setAEntrar(false)
    if (error) return setErro(/Invalid login credentials/i.test(error.message) ? 'Palavra-passe errada.' : mensagemDeErro(error))
    navigate(de, { replace: true })
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-ink-900 px-4">
      <form onSubmit={(e) => void entrar(e)} noValidate className="w-full max-w-sm rounded-3xl bg-cream-50 p-6 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo />
          <h1 className="font-display text-xl">Painel do administrador</h1>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="senha" className="rotulo">
              Palavra-passe
            </label>
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              autoFocus
              className="campo"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              aria-invalid={Boolean(erroSenha)}
              aria-describedby={erroSenha ? 'senha-erro' : undefined}
            />
            {erroSenha && (
              <p id="senha-erro" className="mt-1 text-sm text-ember-600">
                {erroSenha}
              </p>
            )}
          </div>
          {erro && <Aviso>{erro}</Aviso>}
          <button type="submit" className="btn-primario w-full py-3" disabled={aEntrar}>
            {aEntrar ? 'A entrar…' : 'Entrar'}
          </button>
        </div>
      </form>
      <AssinaturaInsight fundoEscuro />
    </main>
  )
}
