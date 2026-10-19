import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { QrImagem } from '../../components/admin/QrImagem'
import { Aviso, Spinner } from '../../components/ui/Ui'
import { mensagemDeErro } from '../../lib/errors'
import { linkDaMesa, supabase } from '../../lib/supabase'
import type { Mesa } from '../../lib/types'

const nomeValido = z.string().trim().min(1, 'O nome não pode ficar vazio.').max(40, 'Máximo 40 caracteres.')

export function GerirMesasPage() {
  const [mesas, setMesas] = useState<Mesa[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [editar, setEditar] = useState<{ id: string; nome: string } | null>(null)
  const [qrAberto, setQrAberto] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('restaurant_tables').select('*').order('numero')
    if (error) return setErro(mensagemDeErro(error))
    setMesas(data as Mesa[])
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function acao(fn: () => PromiseLike<{ error: unknown }>, sucesso: string) {
    setOcupado(true)
    setErro(null)
    setOk(null)
    const { error } = await fn()
    setOcupado(false)
    if (error) return setErro(mensagemDeErro(error))
    setOk(sucesso)
    await carregar()
  }

  function adicionar() {
    const numero = Math.max(0, ...(mesas ?? []).map((m) => m.numero)) + 1
    void acao(() => supabase.from('restaurant_tables').insert({ numero, nome: `Mesa ${numero}` }), `Mesa ${numero} adicionada.`)
  }

  function guardarNome() {
    if (!editar) return
    const r = nomeValido.safeParse(editar.nome)
    if (!r.success) return setErro(r.error.issues[0]?.message ?? 'Nome inválido.')
    const { id } = editar
    setEditar(null)
    void acao(() => supabase.from('restaurant_tables').update({ nome: r.data }).eq('id', id), 'Nome guardado.')
  }

  async function apagar(m: Mesa) {
    if (!window.confirm(`Apagar a ${m.nome}? Só é possível se nunca teve pedidos.`)) return
    setOcupado(true)
    setErro(null)
    setOk(null)
    const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('table_id', m.id)
    if (count && count > 0) {
      setOcupado(false)
      return setErro(`A ${m.nome} tem ${count} pedido(s) no histórico e não pode ser apagada. Pode desativá-la.`)
    }
    setOcupado(false)
    await acao(() => supabase.from('restaurant_tables').delete().eq('id', m.id), `${m.nome} apagada.`)
  }

  function regenerar(m: Mesa) {
    if (!window.confirm(`Gerar um QR Code novo para a ${m.nome}? O QR impresso atual deixa de funcionar.`)) return
    void acao(async () => {
      const { data, error } = await supabase.rpc('gerar_token')
      if (error) return { error }
      return supabase.from('restaurant_tables').update({ qr_token: data as string }).eq('id', m.id)
    }, `QR Code da ${m.nome} renovado. Imprima-o de novo.`)
  }

  if (!mesas) return erro ? <Aviso>{erro}</Aviso> : <Spinner />

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Gerir mesas</h1>
        <div className="flex gap-2">
          <Link to="/admin/qrcodes" className="btn-secundario">
            Imprimir QR Codes
          </Link>
          <button type="button" className="btn-primario" disabled={ocupado} onClick={adicionar}>
            + Adicionar mesa
          </button>
        </div>
      </div>
      <div className="mb-4 flex flex-col gap-2">
        {erro && <Aviso>{erro}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}
      </div>

      <ul className="flex flex-col gap-2">
        {mesas.map((m) => (
          <li key={m.id} className={`cartao p-3 ${m.ativa ? '' : 'opacity-60'}`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-10 text-center font-display text-xl text-muted">{m.numero}</span>
              {editar?.id === m.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    guardarNome()
                  }}
                >
                  <input
                    className="campo max-w-xs"
                    value={editar.nome}
                    maxLength={40}
                    autoFocus
                    aria-label="Nome da mesa"
                    onChange={(e) => setEditar({ ...editar, nome: e.target.value })}
                  />
                  <button type="submit" className="btn-primario">
                    Guardar
                  </button>
                  <button type="button" className="btn-secundario" onClick={() => setEditar(null)}>
                    Cancelar
                  </button>
                </form>
              ) : (
                <span className="flex-1 font-semibold">
                  {m.nome} {!m.ativa && <span className="ml-1 text-sm font-normal text-muted">(desativada)</span>}
                </span>
              )}
              {editar?.id !== m.id && (
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className="btn-secundario min-h-9 text-sm" onClick={() => setQrAberto(qrAberto === m.id ? null : m.id)}>
                    {qrAberto === m.id ? 'Esconder QR' : 'Ver QR'}
                  </button>
                  <button type="button" className="btn-secundario min-h-9 text-sm" onClick={() => setEditar({ id: m.id, nome: m.nome })}>
                    Renomear
                  </button>
                  <button
                    type="button"
                    className="btn-secundario min-h-9 text-sm"
                    disabled={ocupado}
                    onClick={() =>
                      void acao(
                        () => supabase.from('restaurant_tables').update({ ativa: !m.ativa }).eq('id', m.id),
                        m.ativa ? `${m.nome} desativada: o QR deixa de aceitar pedidos.` : `${m.nome} ativada.`,
                      )
                    }
                  >
                    {m.ativa ? 'Desativar' : 'Ativar'}
                  </button>
                  <button type="button" className="btn-secundario min-h-9 text-sm text-ember-600" disabled={ocupado} onClick={() => void apagar(m)}>
                    Apagar
                  </button>
                </div>
              )}
            </div>
            {qrAberto === m.id && (
              <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-cream-200 pt-3">
                <QrImagem texto={linkDaMesa(m.qr_token)} tamanho={160} rotulo={`QR Code da ${m.nome}`} />
                <div className="flex flex-col gap-2 text-sm">
                  <a href={linkDaMesa(m.qr_token)} target="_blank" rel="noreferrer" className="break-all text-ink-800 underline">
                    {linkDaMesa(m.qr_token)}
                  </a>
                  <button type="button" className="btn-secundario w-fit min-h-9 text-sm" disabled={ocupado} onClick={() => regenerar(m)}>
                    Gerar QR novo
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
