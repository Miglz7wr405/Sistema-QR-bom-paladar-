import { useEffect, useState } from 'react'
import { QrImagem } from '../../components/admin/QrImagem'
import { Aviso, Logo, Spinner } from '../../components/ui/Ui'
import { descarregarPdf, descarregarPng } from '../../lib/cartoesQr'
import { mensagemDeErro } from '../../lib/errors'
import { linkDaMesa, SITE_URL, supabase } from '../../lib/supabase'
import type { Mesa } from '../../lib/types'

export function QrCodesPage() {
  const [mesas, setMesas] = useState<Mesa[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aExportar, setAExportar] = useState<string | null>(null)

  async function exportar(chave: string, fn: () => Promise<void>) {
    setAExportar(chave)
    setErro(null)
    try {
      await fn()
    } catch {
      setErro('Não foi possível exportar. Tente de novo.')
    } finally {
      setAExportar(null)
    }
  }

  useEffect(() => {
    supabase
      .from('restaurant_tables')
      .select('*')
      .eq('ativa', true)
      .order('numero')
      .then(({ data, error }) => (error ? setErro(mensagemDeErro(error)) : setMesas(data as Mesa[])))
  }, [])

  if (erro && !mesas) return <Aviso>{erro}</Aviso>
  if (!mesas) return <Spinner />

  const local = /localhost|127\.0\.0\.1/.test(SITE_URL)

  return (
    <>
      <div className="nao-imprimir mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">QR Codes das mesas</h1>
          <p className="text-sm text-muted">Um cartão por mesa ativa. O PDF tem 4 cartões por folha A4 (tamanho A6), com linhas de corte.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-dourado"
            disabled={aExportar !== null || mesas.length === 0}
            onClick={() => void exportar('pdf', () => descarregarPdf(mesas.map((m) => ({ nome: m.nome, link: linkDaMesa(m.qr_token) }))))}
          >
            {aExportar === 'pdf' ? 'A preparar o PDF…' : '⬇ Descarregar PDF (todas as mesas)'}
          </button>
          <button type="button" className="btn-secundario" onClick={() => window.print()}>
            Imprimir esta página
          </button>
        </div>
      </div>
      {erro && (
        <div className="nao-imprimir mb-4">
          <Aviso>{erro}</Aviso>
        </div>
      )}
      {local && (
        <div className="nao-imprimir mb-4">
          <Aviso tipo="info">
            Os QR apontam para {SITE_URL}. Antes de imprimir, defina VITE_SITE_URL com o endereço público do site (por exemplo o da Vercel).
          </Aviso>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-6">
        {mesas.map((m) => (
          <div key={m.id} className="flex break-inside-avoid flex-col items-center gap-3 rounded-3xl border-2 border-ink-900 bg-white p-6 text-center">
            <Logo />
            <p className="font-display text-4xl text-ink-900">{m.nome}</p>
            <QrImagem texto={linkDaMesa(m.qr_token)} tamanho={200} rotulo={`QR Code da ${m.nome}`} />
            <p className="font-semibold text-ink-900">Aponte a câmara para ver o cardápio</p>
            <p className="text-xs text-muted">Peça pelo telemóvel e pague no fim, ao atendente ou no caixa.</p>
            <p className="flex items-center gap-2 text-[11px] text-muted">
              Feito por <img src="/marca/insight-escuro.png" alt="insight creative agency" className="h-4 w-auto" />
            </p>
            <button
              type="button"
              className="btn-secundario nao-imprimir min-h-9 text-sm"
              disabled={aExportar !== null}
              onClick={() => void exportar(m.id, () => descarregarPng(m.nome, linkDaMesa(m.qr_token)))}
            >
              {aExportar === m.id ? 'A preparar…' : `⬇ Imagem da ${m.nome} (PNG)`}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
