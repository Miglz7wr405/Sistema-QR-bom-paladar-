import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { formatarHora } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Pedido } from '../../lib/types'
import { Aviso, Logo } from '../ui/Ui'

interface Realtime {
  /** Muda sempre que um pedido é criado ou alterado: as páginas voltam a carregar os dados. */
  versao: number
  /** Mesas com pedidos novos ainda não vistos. */
  mesasNovas: Set<string>
  marcarVista: (tableId: string) => void
}

const RealtimeContext = createContext<Realtime>({ versao: 0, mesasNovas: new Set(), marcarVista: () => undefined })
export const useRealtime = () => useContext(RealtimeContext)

const links = [
  ['/admin', 'Mesas'],
  ['/admin/historico', 'Histórico'],
  ['/admin/cardapio', 'Cardápio'],
  ['/admin/mesas', 'Gerir mesas'],
  ['/admin/qrcodes', 'QR Codes'],
] as const

/** Toque curto de duas notas, gerado no navegador (não precisa de ficheiro de som). */
function tocarAlerta(ctx: AudioContext) {
  const agora = ctx.currentTime
  ;[0, 0.18].forEach((atraso, i) => {
    const osc = ctx.createOscillator()
    const ganho = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = i === 0 ? 880 : 1320
    ganho.gain.setValueAtTime(0.0001, agora + atraso)
    ganho.gain.exponentialRampToValueAtTime(0.4, agora + atraso + 0.02)
    ganho.gain.exponentialRampToValueAtTime(0.0001, agora + atraso + 0.35)
    osc.connect(ganho).connect(ctx.destination)
    osc.start(agora + atraso)
    osc.stop(agora + atraso + 0.4)
  })
}

export function AdminLayout() {
  const { sessao, admin } = useAuth()
  const navigate = useNavigate()
  const [versao, setVersao] = useState(0)
  const [mesasNovas, setMesasNovas] = useState<Set<string>>(new Set())
  const [alerta, setAlerta] = useState<string | null>(null)
  const [somAtivo, setSomAtivo] = useState(false)
  const [ligado, setLigado] = useState(true)
  const audio = useRef<AudioContext | null>(null)
  const nomesMesas = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    supabase
      .from('restaurant_tables')
      .select('id, nome')
      .then(({ data }) => data?.forEach((m) => nomesMesas.current.set(m.id, m.nome)))
  }, [versao])

  useEffect(() => {
    const canal = supabase
      .channel('pedidos-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (msg) => {
        setVersao((v) => v + 1)
        if (msg.eventType === 'INSERT') {
          const pedido = msg.new as Pedido
          setMesasNovas((s) => new Set(s).add(pedido.table_id))
          const nome = nomesMesas.current.get(pedido.table_id) ?? 'Mesa'
          setAlerta(`Pedido novo · ${nome} · ${formatarHora(pedido.criado_em)}`)
          if (audio.current) tocarAlerta(audio.current)
        }
      })
      .subscribe((estado) => setLigado(estado === 'SUBSCRIBED'))
    return () => {
      void supabase.removeChannel(canal)
    }
  }, [])

  useEffect(() => {
    if (!alerta) return
    const id = window.setTimeout(() => setAlerta(null), 8000)
    return () => window.clearTimeout(id)
  }, [alerta])

  const marcarVista = useCallback((tableId: string) => {
    setMesasNovas((s) => {
      if (!s.has(tableId)) return s
      const n = new Set(s)
      n.delete(tableId)
      return n
    })
  }, [])

  function ativarSom() {
    // Os navegadores só deixam tocar som depois de um clique.
    audio.current ??= new AudioContext()
    void audio.current.resume()
    tocarAlerta(audio.current)
    setSomAtivo(true)
  }

  async function sair() {
    await supabase.auth.signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <RealtimeContext.Provider value={{ versao, mesasNovas, marcarVista }}>
      <div className="min-h-dvh bg-cream-50">
        <header className="nao-imprimir sticky top-0 z-30 bg-ink-900 text-cream-50 shadow">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Logo claro />
            <nav aria-label="Painel" className="order-3 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
              {links.map(([para, rotulo]) => (
                <NavLink
                  key={para}
                  to={para}
                  end={para === '/admin'}
                  className={({ isActive }) =>
                    `shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-gold-500 text-ink-950' : 'text-cream-200 hover:bg-ink-800'}`
                  }
                >
                  {rotulo}
                </NavLink>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              {!ligado && <span className="text-xs text-ember-400">Sem tempo real…</span>}
              <button
                type="button"
                onClick={ativarSom}
                className={`btn min-h-9 px-3 text-sm ${somAtivo ? 'bg-basil-500 text-white' : 'bg-gold-500 text-ink-950'}`}
                title="Os navegadores só tocam som depois de um clique"
              >
                {somAtivo ? '🔔 Som ativo' : '🔕 Ativar som'}
              </button>
              <button type="button" onClick={() => void sair()} className="btn min-h-9 px-3 text-sm text-cream-200 hover:bg-ink-800">
                Sair
              </button>
            </div>
          </div>
        </header>

        {alerta && (
          <button
            type="button"
            onClick={() => setAlerta(null)}
            className="nao-imprimir fixed inset-x-0 top-3 z-50 mx-auto w-fit animate-bounce rounded-2xl bg-ember-500 px-5 py-3 font-semibold text-white shadow-2xl"
          >
            🔔 {alerta}
          </button>
        )}

        <main className="mx-auto max-w-6xl px-4 py-6">
          {sessao && !admin && (
            <div className="mb-4">
              <Aviso>
                Esta conta ({sessao.user.email}) ainda não é administradora, por isso não vê dados. Siga o passo “Criar o administrador” no README.
              </Aviso>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </RealtimeContext.Provider>
  )
}
