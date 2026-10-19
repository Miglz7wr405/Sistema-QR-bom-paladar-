import { useEffect, useState } from 'react'
import { QrImagem } from '../../components/admin/QrImagem'
import { Aviso, Logo, Spinner } from '../../components/ui/Ui'
import { mensagemDeErro } from '../../lib/errors'
import { linkDaMesa, SITE_URL, supabase } from '../../lib/supabase'
import type { Mesa } from '../../lib/types'

export function QrCodesPage() {
  const [mesas, setMesas] = useState<Mesa[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('restaurant_tables')
      .select('*')
      .eq('ativa', true)
      .order('numero')
      .then(({ data, error }) => (error ? setErro(mensagemDeErro(error)) : setMesas(data as Mesa[])))
  }, [])

  if (erro) return <Aviso>{erro}</Aviso>
  if (!mesas) return <Spinner />

  const local = /localhost|127\.0\.0\.1/.test(SITE_URL)

  return (
    <>
      <div className="nao-imprimir mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">QR Codes das mesas</h1>
          <p className="text-sm text-muted">Um cartão por mesa ativa. Imprima em A4 e recorte.</p>
        </div>
        <button type="button" className="btn-primario" onClick={() => window.print()}>
          Imprimir
        </button>
      </div>
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
            <p className="text-xs text-muted">Peça pelo telemóvel e pague no fim, ao empregado ou no caixa.</p>
          </div>
        ))}
      </div>
    </>
  )
}
