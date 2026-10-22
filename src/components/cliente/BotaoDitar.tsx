import { useState } from 'react'
import { ditadoSuportado } from '../../lib/ditado'

interface Props {
  aOuvir: boolean
  aoIniciar: () => void
  aoParar: () => void
}

/** Botão 🎤 ao lado de um campo de nota. Não aparece onde o navegador não sabe reconhecer voz. */
export function BotaoDitar({ aOuvir, aoIniciar, aoParar }: Props) {
  const [suportado] = useState(ditadoSuportado)
  if (!suportado) return null
  return (
    <button
      type="button"
      onClick={aOuvir ? aoParar : aoIniciar}
      aria-label={aOuvir ? 'Parar de ouvir' : 'Escrever com a voz'}
      aria-pressed={aOuvir}
      title={aOuvir ? 'A ouvir… toque para parar' : 'Escrever com a voz'}
      className={`btn h-11 w-11 shrink-0 rounded-full p-0 ${aOuvir ? 'animate-pulse bg-ember-600 text-white' : 'bg-ink-900 text-gold-300 hover:bg-ink-800'}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" />
      </svg>
    </button>
  )
}

/** Linha de estado por baixo do campo: "A ouvir…" ou a mensagem de erro. */
export function EstadoDitado({ aOuvir, erro }: { aOuvir: boolean; erro: string | null }) {
  if (aOuvir) return <p className="mt-1 text-xs font-semibold text-ember-600">🎤 A ouvir… fale agora (toque no microfone para parar)</p>
  if (erro) return <p className="mt-1 text-xs text-ember-600">{erro}</p>
  return null
}
