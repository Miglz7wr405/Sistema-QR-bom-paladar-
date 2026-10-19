import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spinner } from '../components/ui/Ui'
import { supabase } from './supabase'

interface Auth {
  sessao: Session | null
  aCarregar: boolean
  /** Só tem acesso aos dados quem tem app_metadata.role = 'admin' (as regras da base confirmam). */
  admin: boolean
}

const AuthContext = createContext<Auth>({ sessao: null, aCarregar: true, admin: false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [aCarregar, setACarregar] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setACarregar(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const admin = sessao?.user.app_metadata?.role === 'admin'
  return <AuthContext.Provider value={{ sessao, aCarregar, admin }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { sessao, aCarregar } = useAuth()
  const local = useLocation()
  if (aCarregar) return <Spinner />
  if (!sessao) return <Navigate to="/admin/login" replace state={{ de: local.pathname }} />
  return <>{children}</>
}
