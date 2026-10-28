import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Logo, Spinner } from './components/ui/Ui'
import { AuthProvider, ProtectedRoute } from './lib/auth'
import { configurado } from './lib/supabase'
import { MesaPage } from './pages/cliente/MesaPage'

// O painel só é descarregado por quem o abre: o telemóvel do cliente carrega apenas o cardápio.
const AdminLayout = lazy(() => import('./components/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const LoginPage = lazy(() => import('./pages/admin/LoginPage').then((m) => ({ default: m.LoginPage })))
const MesasPage = lazy(() => import('./pages/admin/MesasPage').then((m) => ({ default: m.MesasPage })))
const MesaDetalhePage = lazy(() => import('./pages/admin/MesaDetalhePage').then((m) => ({ default: m.MesaDetalhePage })))
const HistoricoPage = lazy(() => import('./pages/admin/HistoricoPage').then((m) => ({ default: m.HistoricoPage })))
const CardapioPage = lazy(() => import('./pages/admin/CardapioPage').then((m) => ({ default: m.CardapioPage })))
const GerirMesasPage = lazy(() => import('./pages/admin/GerirMesasPage').then((m) => ({ default: m.GerirMesasPage })))
const QrCodesPage = lazy(() => import('./pages/admin/QrCodesPage').then((m) => ({ default: m.QrCodesPage })))
const CozinhaLinkPage = lazy(() => import('./pages/admin/CozinhaLinkPage').then((m) => ({ default: m.CozinhaLinkPage })))
// Ecrã da cozinha: carregado à parte, como o painel.
const CozinhaPage = lazy(() => import('./pages/cozinha/CozinhaPage').then((m) => ({ default: m.CozinhaPage })))

function Inicio() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink-900 px-6 text-center text-cream-50">
      <Logo claro />
      <p className="max-w-xs text-cream-200">Para ver o cardápio e fazer o pedido, aponte a câmara para o QR Code da sua mesa.</p>
    </main>
  )
}

function SemConfiguracao() {
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="font-display text-2xl">Falta configurar o Supabase</h1>
      <p className="mt-2 text-muted">
        Copie <code>.env.example</code> para <code>.env</code> e preencha <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>. Na Vercel,
        defina as mesmas variáveis em Settings → Environment Variables.
      </p>
    </main>
  )
}

export function App() {
  if (!configurado) return <SemConfiguracao />
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/m/:token" element={<MesaPage />} />
            <Route path="/cozinha/:token" element={<CozinhaPage />} />
            <Route path="/admin/login" element={<LoginPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<MesasPage />} />
              <Route path="mesas" element={<GerirMesasPage />} />
              <Route path="mesas/:id" element={<MesaDetalhePage />} />
              <Route path="historico" element={<HistoricoPage />} />
              <Route path="cardapio" element={<CardapioPage />} />
              <Route path="qrcodes" element={<QrCodesPage />} />
              <Route path="cozinha" element={<CozinhaLinkPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
