import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Aviso, Logo } from '../../components/ui/Ui'
import { useAuth } from '../../lib/auth'
import { mensagemDeErro } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

const esquema = z.object({
  email: z.string().trim().email('Escreva um email válido.'),
  senha: z.string().min(6, 'A senha tem pelo menos 6 caracteres.'),
})

export function LoginPage() {
  const { sessao } = useAuth()
  const navigate = useNavigate()
  const de = (useLocation().state as { de?: string } | null)?.de ?? '/admin'
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erros, setErros] = useState<{ email?: string; senha?: string }>({})
  const [erro, setErro] = useState<string | null>(null)
  const [aEntrar, setAEntrar] = useState(false)

  if (sessao) return <Navigate to={de} replace />

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const r = esquema.safeParse({ email, senha })
    if (!r.success) {
      const f = r.error.flatten().fieldErrors
      setErros({ email: f.email?.[0], senha: f.senha?.[0] })
      return
    }
    setErros({})
    setAEntrar(true)
    const { error } = await supabase.auth.signInWithPassword({ email: r.data.email, password: r.data.senha })
    setAEntrar(false)
    if (error) return setErro(mensagemDeErro(error))
    navigate(de, { replace: true })
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink-900 px-4">
      <form onSubmit={(e) => void entrar(e)} noValidate className="w-full max-w-sm rounded-3xl bg-cream-50 p-6 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo />
          <h1 className="font-display text-xl">Painel do administrador</h1>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="rotulo">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              className="campo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(erros.email)}
              aria-describedby={erros.email ? 'email-erro' : undefined}
            />
            {erros.email && (
              <p id="email-erro" className="mt-1 text-sm text-ember-600">
                {erros.email}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="senha" className="rotulo">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              className="campo"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              aria-invalid={Boolean(erros.senha)}
              aria-describedby={erros.senha ? 'senha-erro' : undefined}
            />
            {erros.senha && (
              <p id="senha-erro" className="mt-1 text-sm text-ember-600">
                {erros.senha}
              </p>
            )}
          </div>
          {erro && <Aviso>{erro}</Aviso>}
          <button type="submit" className="btn-primario w-full py-3" disabled={aEntrar}>
            {aEntrar ? 'A entrar…' : 'Entrar'}
          </button>
        </div>
      </form>
    </main>
  )
}
