import { useEffect, useState } from 'react'
import { useRealtime } from '../../components/admin/AdminLayout'
import { CartaoPedido } from '../../components/admin/CartaoPedido'
import { Aviso, Spinner, Vazio } from '../../components/ui/Ui'
import { mensagemDeErro } from '../../lib/errors'
import { formatarPreco, hojeEmMaputo, limitesDoDia } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Pedido } from '../../lib/types'

const POR_PAGINA = 50

export function HistoricoPage() {
  const { versao } = useRealtime()
  const [mesas, setMesas] = useState<{ id: string; nome: string; numero: number }[]>([])
  const [mesa, setMesa] = useState('')
  const [dia, setDia] = useState(hojeEmMaputo())
  const [limite, setLimite] = useState(POR_PAGINA)
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null)
  const [haMais, setHaMais] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('restaurant_tables')
      .select('id, nome, numero')
      .order('numero')
      .then(({ data }) => setMesas(data ?? []))
  }, [])

  useEffect(() => setLimite(POR_PAGINA), [mesa, dia])

  useEffect(() => {
    let ativo = true
    let q = supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('criado_em', { ascending: false })
      .limit(limite + 1)
    if (mesa) q = q.eq('table_id', mesa)
    if (dia) {
      const { de, ate } = limitesDoDia(dia)
      q = q.gte('criado_em', de).lt('criado_em', ate)
    }
    q.then(({ data, error }) => {
      if (!ativo) return
      if (error) return setErro(mensagemDeErro(error))
      setErro(null)
      setHaMais(data.length > limite)
      setPedidos((data as Pedido[]).slice(0, limite))
    })
    return () => {
      ativo = false
    }
  }, [mesa, dia, limite, versao])

  const nomeMesa = (id: string) => mesas.find((m) => m.id === id)?.nome ?? 'Mesa'
  const validos = (pedidos ?? []).filter((p) => p.estado !== 'cancelado')

  return (
    <>
      <h1 className="mb-4 font-display text-2xl">Histórico de pedidos</h1>
      <div className="cartao mb-5 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="f-mesa" className="rotulo">
            Mesa
          </label>
          <select id="f-mesa" className="campo min-w-40" value={mesa} onChange={(e) => setMesa(e.target.value)}>
            <option value="">Todas</option>
            {mesas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-dia" className="rotulo">
            Dia
          </label>
          <input id="f-dia" type="date" className="campo" value={dia} onChange={(e) => setDia(e.target.value)} />
        </div>
        {dia && (
          <button type="button" className="btn-secundario" onClick={() => setDia('')}>
            Todos os dias
          </button>
        )}
        {pedidos && (
          <p className="ml-auto text-sm text-muted">
            {validos.length} pedido(s) · <strong className="text-ink-900">{formatarPreco(validos.reduce((s, p) => s + Number(p.total), 0))}</strong>
            {haMais && ' (nesta página)'}
          </p>
        )}
      </div>

      {erro && (
        <div className="mb-4">
          <Aviso>{erro}</Aviso>
        </div>
      )}

      {!pedidos ? (
        <Spinner />
      ) : pedidos.length === 0 ? (
        <Vazio titulo="Sem pedidos" texto="Não há pedidos com estes filtros." />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {pedidos.map((p) => (
              <CartaoPedido key={p.id} pedido={p} mesaNome={nomeMesa(p.table_id)} comData />
            ))}
          </div>
          {haMais && (
            <div className="mt-5 text-center">
              <button type="button" className="btn-secundario" onClick={() => setLimite((l) => l + POR_PAGINA)}>
                Carregar mais
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
