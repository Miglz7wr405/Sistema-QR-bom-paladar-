import { useCallback, useEffect, useRef, useState } from 'react'

// Ditar as notas do pedido com a voz, usando o reconhecimento de voz do próprio navegador
// (Chrome no Android, Safari no iPhone): o texto aparece enquanto a pessoa fala, sem chave nem servidor.

interface ResultadoVoz {
  readonly length: number
  [i: number]: { transcript: string }
}

interface EventoVoz {
  results: ArrayLike<ResultadoVoz>
}

interface Reconhecimento {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onresult: ((e: EventoVoz) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type ClasseReconhecimento = new () => Reconhecimento

function classeReconhecimento(): ClasseReconhecimento | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: ClasseReconhecimento; webkitSpeechRecognition?: ClasseReconhecimento }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const ditadoSuportado = () => classeReconhecimento() !== null

const MENSAGENS: Record<string, string> = {
  'not-allowed': 'Permita o acesso ao microfone para ditar.',
  'service-not-allowed': 'O ditado não está disponível neste telemóvel. Use o microfone do teclado.',
  'language-not-supported': 'O ditado não está disponível neste telemóvel. Use o microfone do teclado.',
  'audio-capture': 'Não encontrámos o microfone.',
  network: 'Sem internet para ditar. Tente outra vez.',
  'no-speech': 'Não ouvimos nada. Fale mais perto do telemóvel.',
}

/** Junta o que já estava escrito com o que foi dito, sem passar do limite do campo. */
export function juntarTexto(base: string, falado: string, max: number): string {
  const f = falado.replace(/\s+/g, ' ').trim()
  const b = base.trimEnd()
  if (!f) return base.slice(0, max)
  const texto = b ? `${b} ${f}` : f.charAt(0).toUpperCase() + f.slice(1)
  return texto.slice(0, max)
}

/**
 * `iniciar(base, max)` começa a ouvir; cada pedaço reconhecido chama `aoMudar` com o texto completo do campo.
 * Com `continuous: true`, aguenta pausas a meio da frase. Pára com `parar()` ou ao fechar o carrinho.
 */
export function useDitado(aoMudar: (texto: string) => void, aoAcabar?: () => void) {
  const [aOuvir, setAOuvir] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const rec = useRef<Reconhecimento | null>(null)
  const callbacks = useRef({ aoMudar, aoAcabar })

  useEffect(() => {
    callbacks.current = { aoMudar, aoAcabar }
  })

  // Ao fechar o carrinho a meio, pára de ouvir (o que já foi dito fica).
  useEffect(() => () => rec.current?.abort(), [])

  const parar = useCallback(() => rec.current?.stop(), [])

  const iniciar = useCallback((base: string, max: number) => {
    const Classe = classeReconhecimento()
    if (!Classe) return
    rec.current?.abort()
    const r = new Classe()
    r.lang = 'pt-PT'
    r.interimResults = true
    r.continuous = true
    r.maxAlternatives = 1
    r.onresult = (e) => {
      const falado = Array.from(e.results, (x) => x[0]?.transcript ?? '').join(' ').replace(/\s+/g, ' ')
      callbacks.current.aoMudar(juntarTexto(base, falado, max))
    }
    r.onerror = (e) => setErro(MENSAGENS[e.error] ?? null)
    r.onend = () => {
      if (rec.current !== r) return
      rec.current = null
      setAOuvir(false)
      callbacks.current.aoAcabar?.()
    }
    rec.current = r
    setErro(null)
    setAOuvir(true)
    try {
      r.start()
    } catch {
      rec.current = null
      setAOuvir(false)
      setErro('Não foi possível ligar o microfone. Tente outra vez.')
    }
  }, [])

  return { aOuvir, erro, iniciar, parar }
}
