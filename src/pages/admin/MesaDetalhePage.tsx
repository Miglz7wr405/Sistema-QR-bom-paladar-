import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useRealtime } from '../../components/admin/AdminLayout'
import { BlocoMesa } from '../../components/admin/BlocoMesa'
import { Aviso, Spinner, Vazio } from '../../components/ui/Ui'
import { mensagemDeErro } from '../../lib/errors'
import { formatarHora } from '../../lib/format'
import { agruparPorMesa } from '../../lib/mesas'
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
  }

  if (mesa === undefined) return erro ? <Aviso>{erro}</Aviso> : <Spinner />
  if (mesa === null) return <Vazio titulo="Mesa não encontrada" />

  // A conta da mesa: todos os pedidos desde que abriu, até "Fechar mesa".
  const conta = sessao ? agruparPorMesa([sessao], pedidos)[0] : undefined

  return (
    <>
      <Link to="/admin" className="text-sm text-muted hover:text-ink-900">
        ← Todas as mesas
      </Link>
      <div className="mb-5 mt-2">
        <h1 className="font-display text-3xl">{mesa.nome}</h1>
        <p className="text-sm text-muted">
          {sessao ? `Aberta às ${formatarHora(sessao.aberta_em)}` : 'Livre'}
          {!mesa.ativa && ' · desativada'}
        </p>
      </div>

      {erro && (
        <div className="mb-4">
          <Aviso>{erro}</Aviso>
        </div>
      )}

      {conta ? (
        <div className="max-w-xl">
          <BlocoMesa
            conta={conta}
            mesaNome={mesa.nome}
            ocupado={ocupado}
            aoMudarEstado={(p, e) => void mudarEstado(p, e)}
            aoFechar={() => setRecarregar((n) => n + 1)}
            aoErro={setErro}
          />
        </div>
      ) : (
        <Vazio titulo="Sem pedidos" texto="Quando o cliente fizer um pedido pelo QR Code, ele aparece aqui na hora." />
      )}
    </>
  )
}
