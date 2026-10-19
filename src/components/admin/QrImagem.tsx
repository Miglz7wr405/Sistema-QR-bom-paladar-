import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

export function QrImagem({ texto, tamanho = 220, rotulo }: { texto: string; tamanho?: number; rotulo: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    QRCode.toDataURL(texto, { width: tamanho * 2, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#131315', light: '#ffffff' } })
      .then((url) => ativo && setSrc(url))
      .catch(() => ativo && setSrc(null))
    return () => {
      ativo = false
    }
  }, [texto, tamanho])

  if (!src) return <div style={{ width: tamanho, height: tamanho }} className="animate-pulse rounded-lg bg-cream-100" />
  return <img src={src} width={tamanho} height={tamanho} alt={rotulo} className="rounded-lg" />
}
