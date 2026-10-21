import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Locutor, type PedidoFalado } from '../../lib/anuncios'
import { useAuth } from '../../lib/auth'
import { formatarHora, porAtender } from '../../lib/format'
import { resumoDoPedido } from '../../lib/frase'
import { supabase } from '../../lib/supabase'
import type { EstadoPedido, Pedido } from '../../lib/types'
import { Aviso, Logo } from '../ui/Ui'

interface Realtime {
  /** Muda sempre que um pedido é criado ou alterado: as páginas voltam a carregar os dados. */
  versao: number
  /** Mesas com pedidos novos ainda não vistos. */
  mesasNovas: Set<string>
  marcarVista: (tableId: string) => void
  /** Volta a ler um pedido em voz alta (botão "🔊 Ler de novo"). */
  lerDeNovo: (pedidoId: string) => void
  /** Pedido que está a ser lido agora. */
  aLer: string | null
}

const RealtimeContext = createContext<Realtime>({
  versao: 0,
  mesasNovas: new Set(),
  marcarVista: () => undefined,
  lerDeNovo: () => undefined,
  aLer: null,
})
export const useRealtime = () => useContext(RealtimeContext)

const links = [
  ['/admin', 'Mesas'],
  ['/admin/historico', 'Histórico'],
  ['/admin/cardapio', 'Cardápio'],
  ['/admin/mesas', 'Gerir mesas'],
  ['/admin/qrcodes', 'QR Codes'],
] as const

interface AvisoPedido {
  id: string
  tableId: string
  mesaNome: string
  criadoEm: string
  resumo: string
  notas: string[]
}

const LS_VOZ = 'painel:voz-ligada'

function lerPreferenciaVoz(): boolean {
  try {
    return localStorage.getItem(LS_VOZ) !== 'nao'
  } catch {
    return true
  }
}

export function AdminLayout() {
  const { sessao, admin } = useAuth()
  const navigate = useNavigate()
  const local = useLocation()
  const [versao, setVersao] = useState(0)
  const [mesasNovas, setMesasNovas] = useState<Set<string>>(new Set())
  const [avisos, setAvisos] = useState<AvisoPedido[]>([])
  const [somAtivo, setSomAtivo] = useState(false)
  const [vozLigada, setVozLigada] = useState(lerPreferenciaVoz)
  const [aLer, setALer] = useState<string | null>(null)
  const [ligado, setLigado] = useState(true)
  const locutor = useRef<Locutor | null>(null)
  locutor.current ??= new Locutor()
  const nomesMesas = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    supabase
      .from('restaurant_tables')
      .select('id, nome')
      .then(({ data }) => data?.forEach((m) => nomesMesas.current.set(m.id, m.nome)))
  }, [versao])

  useEffect(() => {
    const l = locutor.current!
    l.aoMudar = setALer
    l.vozLigada = vozLigada
  }, [vozLigada])

  /** Itens do pedido e nome da mesa, para a voz e para o aviso no ecrã. */
  const carregarPedido = useCallback(async (id: string): Promise<(PedidoFalado & { tableId: string; criadoEm: string }) | null> => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, table_id, nota_geral, criado_em, order_items(nome, opcao, quantidade, nota)')
      .eq('id', id)
      .maybeSingle()
    if (error || !data) return null
    let mesaNome: string = nomesMesas.current.get(data.table_id) ?? ''
    if (!mesaNome) {
      const m = await supabase.from('restaurant_tables').select('nome').eq('id', data.table_id).maybeSingle()
      mesaNome = (m.data?.nome as string | undefined) ?? 'Mesa'
      nomesMesas.current.set(data.table_id, mesaNome)
    }
    return {
      id: data.id,
      tableId: data.table_id,
      criadoEm: data.criado_em,
      mesaNome,
      notaGeral: data.nota_geral,
      itens: data.order_items,
    }
  }, [])

  const mostrarAviso = useCallback((p: Awaited<ReturnType<typeof carregarPedido>>) => {
    if (!p) return
    const notas = [...p.itens.filter((i) => i.nota?.trim()).map((i) => `${i.nome}: ${i.nota}`), ...(p.notaGeral?.trim() ? [p.notaGeral] : [])]
    const aviso: AvisoPedido = { id: p.id, tableId: p.tableId, mesaNome: p.mesaNome, criadoEm: p.criadoEm, resumo: resumoDoPedido(p.itens), notas }
    setAvisos((l) => (l.some((a) => a.id === p.id) ? l : [...l, aviso].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))))
  }, [])

  const tirarAviso = useCallback((id: string) => setAvisos((l) => l.filter((a) => a.id !== id)), [])

  useEffect(() => {
    const canal = supabase
      .channel('pedidos-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (msg) => {
        setVersao((v) => v + 1)
        if (msg.eventType === 'INSERT') {
          const pedido = msg.new as Pedido
          setMesasNovas((s) => new Set(s).add(pedido.table_id))
          // A fila de voz segue a ordem dos eventos (a ordem em que os pedidos foram gravados).
          const dados = carregarPedido(pedido.id)
          locutor.current!.anunciar(pedido.id, dados)
          void dados.then(mostrarAviso)
        } else if (msg.eventType === 'UPDATE') {
          const pedido = msg.new as { id: string; estado: EstadoPedido }
          if (!porAtender(pedido.estado)) tirarAviso(pedido.id)
        }
      })
      .subscribe((estado) => setLigado(estado === 'SUBSCRIBED'))
    return () => {
      void supabase.removeChannel(canal)
    }
  }, [carregarPedido, mostrarAviso, tirarAviso])

  const marcarVista = useCallback((tableId: string) => {
    setMesasNovas((s) => {
      if (!s.has(tableId)) return s
      const n = new Set(s)
      n.delete(tableId)
      return n
    })
  }, [])

  async function ativarSom() {
    // Os navegadores só deixam tocar som depois de um clique.
    await locutor.current!.ativar()
    setSomAtivo(true)
  }

  function mudarVoz() {
    const nova = !vozLigada
    setVozLigada(nova)
    try {
      localStorage.setItem(LS_VOZ, nova ? 'sim' : 'nao')
    } catch {
      /* sem armazenamento: vale só nesta página */
    }
  }

  const lerDeNovo = useCallback(
    (id: string) => {
      void (async () => {
        await locutor.current!.ativar()
        setSomAtivo(true)
        locutor.current!.anunciar(id, carregarPedido(id), true)
      })()
    },
    [carregarPedido],
  )

  async function sair() {
    await supabase.auth.signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <RealtimeContext.Provider value={{ versao, mesasNovas, marcarVista, lerDeNovo, aLer }}>
      <div className="min-h-dvh bg-cream-50">
        <header className="nao-imprimir sticky top-0 z-30 bg-ink-900 text-cream-50 shadow">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Logo claro />
            <nav aria-label="Painel" className="order-3 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
              {links.map(([para, rotulo]) => (
                <NavLink
                  key={para}
                  to={para}
                  end={para === '/admin' || para === '/admin/mesas'}
                  className={({ isActive }) => {
                    const ativo = isActive || (para === '/admin' && /^\/admin\/mesas\/[^/]+/.test(local.pathname))
                    return `shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${ativo ? 'bg-gold-500 text-ink-950' : 'text-cream-200 hover:bg-ink-800'}`
                  }}
                >
                  {rotulo}
                </NavLink>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              {!ligado && <span className="text-xs text-ember-400">Sem tempo real…</span>}
              {somAtivo ? (
                <button
                  type="button"
                  onClick={mudarVoz}
                  className={`btn min-h-9 px-3 text-sm ${vozLigada ? 'bg-basil-500 text-white' : 'bg-ink-700 text-cream-200'}`}
                  title="Ligar ou desligar a leitura em voz (o sininho toca sempre)"
                >
                  {vozLigada ? '🔔🗣 Som e voz ativos' : '🔔 Só sininho'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void ativarSom()}
                  className="btn min-h-9 animate-pulse bg-gold-500 px-3 text-sm text-ink-950"
                  title="Os navegadores só tocam som depois de um clique"
                >
                  🔔 Ativar som e voz
                </button>
              )}
              <button type="button" onClick={() => void sair()} className="btn min-h-9 px-3 text-sm text-cream-200 hover:bg-ink-800">
                Sair
              </button>
            </div>
          </div>
        </header>

        {!somAtivo && (
          <button
            type="button"
            onClick={() => void ativarSom()}
            className="nao-imprimir block w-full bg-gold-500 px-4 py-2.5 text-center font-semibold text-ink-950"
          >
            🔔 Toque aqui para ouvir os pedidos (sininho e voz). O navegador só deixa tocar som depois de um toque.
          </button>
        )}

        {avisos.length > 0 && (
          <aside
            aria-label="Pedidos novos"
            className="nao-imprimir pointer-events-none fixed bottom-3 right-3 z-40 flex max-h-[45dvh] w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2 overflow-y-auto"
          >
            {avisos.map((a) => (
              <div
                key={a.id}
                role="status"
                className={`pointer-events-auto rounded-2xl border-2 bg-white p-3 shadow-2xl ${aLer === a.id ? 'border-ember-500' : 'border-gold-500'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/admin/mesas/${a.tableId}`} className="min-w-0 flex-1" onClick={() => marcarVista(a.tableId)}>
                    <p className="font-display text-lg leading-tight">
                      {aLer === a.id && <span aria-label="A ler">🔊 </span>}
                      {a.mesaNome} pediu <span className="text-sm font-sans font-normal text-muted">· {formatarHora(a.criadoEm)}</span>
                    </p>
                    <p className="mt-0.5 text-sm text-ink-800">{a.resumo}</p>
                    {a.notas.map((n, i) => (
                      <p key={i} className="mt-1 rounded-md bg-gold-200/70 px-2 py-0.5 text-sm font-semibold text-ember-600">
                        Nota: {n}
                      </p>
                    ))}
                  </Link>
                  <button type="button" onClick={() => tirarAviso(a.id)} className="btn min-h-8 px-2 text-muted hover:text-ink-900" aria-label="Fechar aviso">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </aside>
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
