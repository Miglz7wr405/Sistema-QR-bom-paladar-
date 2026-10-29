import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { PedidoFalado } from '../../lib/anuncios'
import { useAuth } from '../../lib/auth'
import { formatarHora, porAtender } from '../../lib/format'
import { resumoDoPedido, type ItemFalado } from '../../lib/frase'
import { useLocutor } from '../../lib/som'
import { supabase } from '../../lib/supabase'
import type { Pedido } from '../../lib/types'
import { AssinaturaInsight, Aviso, Logo } from '../ui/Ui'

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
  ['/admin/cozinha', '🍳 Cozinha'],
] as const

/** Pedido novo, a cozinha carregou "Começar", a cozinha carregou "Pronto". */
type Fase = 'novo' | 'a_preparar' | 'pronto'

interface AvisoPedido {
  id: string
  tableId: string
  mesaNome: string
  /** Hora do pedido, do "Começar" ou do "Pronto", conforme a fase. */
  quando: string
  fase: Fase
  resumo: string
  notas: string[]
}

type PedidoCarregado = Omit<PedidoFalado, 'itens'> & { tableId: string; itens: (ItemFalado & { para_cozinha: boolean })[] }

/** Só a comida: o que a cozinha prepara e a recepção leva à mesa. */
const soCozinha = (p: PedidoCarregado | null): PedidoCarregado | null => p && { ...p, itens: p.itens.filter((i) => i.para_cozinha) }

/** Carregaram "Começar"/"Pronto" há pouco (os eventos antigos que chegam ao abrir o painel não contam). */
const recente = (hora: string | null | undefined): hora is string => Boolean(hora) && Date.now() - new Date(hora!).getTime() < 5 * 60_000

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
  const [vozLigada, setVozLigada] = useState(lerPreferenciaVoz)
  const [ligado, setLigado] = useState(true)
  const { locutor, somAtivo, aLer, ativarSom } = useLocutor()
  const nomesMesas = useRef<Map<string, string>>(new Map())
  // Fase que cada pedido já mostrou no aviso: um aviso fechado com ✕ só volta quando muda de fase.
  const fasesMostradas = useRef<Map<string, Fase>>(new Map())

  useEffect(() => {
    supabase
      .from('restaurant_tables')
      .select('id, nome')
      .then(({ data }) => data?.forEach((m) => nomesMesas.current.set(m.id, m.nome)))
  }, [versao])

  useEffect(() => {
    locutor.vozLigada = vozLigada
  }, [locutor, vozLigada])

  /** Itens do pedido e nome da mesa, para a voz e para o aviso no ecrã. */
  const carregarPedido = useCallback(async (id: string): Promise<PedidoCarregado | null> => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, table_id, nota_geral, order_items(nome, opcao, quantidade, nota, para_cozinha)')
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
      mesaNome,
      notaGeral: data.nota_geral,
      itens: data.order_items,
    }
  }, [])

  /** Mostra o aviso do pedido nesta fase; se já havia um aviso do mesmo pedido, passa a ser este. */
  const mostrarAviso = useCallback((p: PedidoCarregado | null, fase: Fase, quando: string) => {
    if (!p) return
    fasesMostradas.current.set(p.id, fase)
    const notas = [...p.itens.filter((i) => i.nota?.trim()).map((i) => `${i.nome}: ${i.nota}`), ...(p.notaGeral?.trim() ? [p.notaGeral] : [])]
    const aviso: AvisoPedido = { id: p.id, tableId: p.tableId, mesaNome: p.mesaNome, quando, fase, resumo: resumoDoPedido(p.itens), notas }
    setAvisos((l) => [...l.filter((a) => a.id !== p.id), aviso].sort((a, b) => a.quando.localeCompare(b.quando)))
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
          locutor.anunciar(pedido.id, dados)
          void dados.then((p) => mostrarAviso(p, 'novo', pedido.criado_em))
        } else if (msg.eventType === 'UPDATE') {
          const pedido = msg.new as Pedido
          const fase = fasesMostradas.current.get(pedido.id)
          if (!porAtender(pedido.estado)) tirarAviso(pedido.id)
          // A cozinha carregou "Pronto": aviso verde e "Mesa 9, a cozinha terminou de fazer: <a comida>. Pode levar à mesa." (uma só vez).
          else if (recente(pedido.cozinha_pronto_em)) {
            if (fase === 'pronto') return
            const hora = pedido.cozinha_pronto_em
            const dados = carregarPedido(pedido.id).then(soCozinha)
            locutor.anunciarPronto(pedido.id, dados)
            void dados.then((p) => mostrarAviso(p, 'pronto', hora))
          }
          // A cozinha carregou "Começar": aviso e "Mesa 9, a cozinha está a preparar: <a comida>" (uma só vez).
          else if (!pedido.cozinha_pronto_em && recente(pedido.cozinha_inicio_em)) {
            if (fase === 'a_preparar' || fase === 'pronto') return
            const hora = pedido.cozinha_inicio_em
            const dados = carregarPedido(pedido.id).then(soCozinha)
            locutor.anunciarComecou(pedido.id, dados)
            void dados.then((p) => mostrarAviso(p, 'a_preparar', hora))
          }
        }
      })
      .subscribe((estado) => setLigado(estado === 'SUBSCRIBED'))
    return () => {
      void supabase.removeChannel(canal)
    }
  }, [carregarPedido, mostrarAviso, tirarAviso, locutor])

  const marcarVista = useCallback((tableId: string) => {
    setMesasNovas((s) => {
      if (!s.has(tableId)) return s
      const n = new Set(s)
      n.delete(tableId)
      return n
    })
  }, [])

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
        await ativarSom()
        locutor.anunciar(id, carregarPedido(id), true)
      })()
    },
    [carregarPedido, ativarSom, locutor],
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
            {/* Os separadores passam para a linha seguinte em vez de ficarem escondidos à direita no telemóvel. */}
            <nav aria-label="Painel" className="order-3 flex w-full flex-wrap gap-1 md:order-none md:w-auto">
              {links.map(([para, rotulo]) => (
                <NavLink
                  key={para}
                  to={para}
                  end={para === '/admin' || para === '/admin/mesas'}
                  className={({ isActive }) => {
                    const ativo = isActive || (para === '/admin' && /^\/admin\/mesas\/[^/]+/.test(local.pathname))
                    const cozinha = para === '/admin/cozinha'
                    return `shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${
                      ativo ? 'bg-gold-500 text-ink-950' : cozinha ? 'text-gold-300 ring-1 ring-gold-500/60 hover:bg-ink-800' : 'text-cream-200 hover:bg-ink-800'
                    }`
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
            className="nao-imprimir block w-full bg-gold-500 px-4 py-1.5 text-center text-sm font-semibold text-ink-950"
          >
            🔔 Toque em qualquer sítio do ecrã para ligar o sininho e a voz
          </button>
        )}

        {avisos.length > 0 && (
          <aside
            aria-label="Avisos de pedidos"
            className="nao-imprimir pointer-events-none fixed bottom-3 right-3 z-40 flex max-h-[45dvh] w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2 overflow-y-auto"
          >
            {avisos.map((a) => (
              <div
                key={a.id}
                role="status"
                className={`pointer-events-auto rounded-2xl border-2 p-3 shadow-2xl ${
                  a.fase === 'pronto' ? 'bg-[#ecf2eb]' : a.fase === 'a_preparar' ? 'bg-[#faf3e1]' : 'bg-white'
                } ${aLer === a.id ? 'border-ember-500' : a.fase === 'pronto' ? 'border-basil-500' : 'border-gold-500'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/admin/mesas/${a.tableId}`} className="min-w-0 flex-1" onClick={() => marcarVista(a.tableId)}>
                    <p className={`font-display text-lg leading-tight ${a.fase === 'pronto' ? 'text-basil-600' : ''}`}>
                      {aLer === a.id && <span aria-label="A ler">🔊 </span>}
                      {a.fase === 'pronto'
                        ? `✅ O pedido da ${a.mesaNome} está pronto para levar à mesa`
                        : a.fase === 'a_preparar'
                          ? `🍳 O pedido da ${a.mesaNome} está a ser preparado`
                          : `${a.mesaNome} pediu`}{' '}
                      <span className="whitespace-nowrap font-sans text-sm font-normal text-muted">· {formatarHora(a.quando)}</span>
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
        <footer className="border-t border-cream-200 py-5">
          <AssinaturaInsight />
        </footer>
      </div>
    </RealtimeContext.Provider>
  )
}
