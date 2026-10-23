import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useRealtime } from '../../components/admin/AdminLayout'
import { CartaoPedido } from '../../components/admin/CartaoPedido'
import { Aviso, Spinner, Vazio } from '../../components/ui/Ui'
import { mensagemDeErro } from '../../lib/errors'
import { dentroDaJanela, formatarHora, formatarPreco, JANELA_MINUTOS, porAtender } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { EstadoPedido, Mesa, Pedido, Sessao } from '../../lib/types'

export function MesaDetalhePage() {
  const { id = '' } = useParams()
  const { versao, marcarVista } = useRealtime()
  const [mesa, setMesa] = useState<Mesa | null | undefined>(undefined)
  const [sessao, setSessao] = useState<Sessao | null>(null)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [recarregar, setRecarregar] = useState(0)
  const [agora, setAgora] = useState(Date.now())

  // Os pedidos atendidos saem da vista 20 minutos depois: volta a desenhar a cada 30 s.
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    marcarVista(id)
  }, [id, versao, marcarVista])

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const [m, s] = await Promise.all([
        supabase.from('restaurant_tables').select('*').eq('id', id).maybeSingle(),
        supabase.from('table_sessions').select('*').eq('table_id', id).is('fechada_em', null).maybeSingle(),
      ])
      if (m.error || s.error) throw m.error ?? s.error
      let lista: Pedido[] = []
      if (s.data) {
        const p = await supabase.from('orders').select('*, order_items(*)').eq('session_id', s.data.id).order('criado_em', { ascending: false })
        if (p.error) throw p.error
        lista = p.data as Pedido[]
      }
      if (!ativo) return
      setMesa(m.data as Mesa | null)
      setSessao(s.data as Sessao | null)
      setPedidos(lista)
      setErro(null)
    }
    carregar().catch((e) => ativo && setErro(mensagemDeErro(e)))
    return () => {
      ativo = false
    }
  }, [id, versao, recarregar])

  async function mudarEstado(pedido: Pedido, estado: EstadoPedido) {
    setOcupado(true)
    const { error } = await supabase.from('orders').update({ estado }).eq('id', pedido.id)
    setOcupado(false)
    if (error) return setErro(mensagemDeErro(error))
    setPedidos((lista) => lista.map((p) => (p.id === pedido.id ? { ...p, estado, atualizado_em: new Date().toISOString() } : p)))
    setAgora(Date.now())
  }

  async function fecharMesa() {
    if (!sessao) return
    const pendentes = pedidos.filter((p) => porAtender(p.estado)).length
    const texto =
      pendentes > 0
        ? `Ainda há ${pendentes} pedido(s) por atender. Fechar a mesa mesmo assim?`
        : 'A conta foi paga? Fechar a mesa deixa-a livre para o próximo cliente.'
    if (!window.confirm(texto)) return
    setOcupado(true)
    const { error } = await supabase.from('table_sessions').update({ fechada_em: new Date().toISOString() }).eq('id', sessao.id)
    setOcupado(false)
    if (error) return setErro(mensagemDeErro(error))
    setRecarregar((n) => n + 1)
  }

  if (mesa === undefined) return erro ? <Aviso>{erro}</Aviso> : <Spinner />
  if (mesa === null) return <Vazio titulo="Mesa não encontrada" />

  const validos = pedidos.filter((p) => p.estado !== 'cancelado')
  // Mais recentes primeiro (a consulta já vem por ordem descendente).
  const pendentes = pedidos.filter((p) => porAtender(p.estado))
  const recentes = pedidos.filter((p) => !porAtender(p.estado) && dentroDaJanela(p.atualizado_em, agora))
  const total = validos.reduce((s, p) => s + Number(p.total), 0)

  return (
    <>
      <Link to="/admin" className="text-sm text-muted hover:text-ink-900">
        ← Todas as mesas
      </Link>
      <div className="mb-5 mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{mesa.nome}</h1>
          <p className="text-sm text-muted">
            {sessao ? `Aberta às ${formatarHora(sessao.aberta_em)} · ${validos.length} pedido(s)` : 'Livre'}
            {!mesa.ativa && ' · desativada'}
          </p>
        </div>
        {sessao && (
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl tabular-nums">{formatarPreco(total)}</span>
            <button type="button" className="btn-perigo" disabled={ocupado} onClick={() => void fecharMesa()}>
              Fechar mesa
            </button>
          </div>
        )}
      </div>

      {erro && (
        <div className="mb-4">
          <Aviso>{erro}</Aviso>
        </div>
      )}

      {pendentes.length === 0 ? (
        <Vazio titulo="Nada por atender" texto="Quando o cliente fizer um pedido pelo QR Code, ele aparece aqui na hora." />
      ) : (
        <>
          <h2 className="mb-3 font-display text-xl">Por atender ({pendentes.length})</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {pendentes.map((p) => (
              <CartaoPedido key={p.id} pedido={p} ocupado={ocupado} aoMudarEstado={(e) => void mudarEstado(p, e)} />
            ))}
          </div>
        </>
      )}

      {recentes.length > 0 && (
        <section className="mt-8 opacity-70">
          <h2 className="mb-1 font-display text-lg">Atendidos</h2>
          <p className="mb-3 text-sm text-muted">Saem desta lista {JANELA_MINUTOS} minutos depois. Ficam sempre no Histórico.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {recentes.map((p) => (
              <CartaoPedido key={p.id} pedido={p} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
