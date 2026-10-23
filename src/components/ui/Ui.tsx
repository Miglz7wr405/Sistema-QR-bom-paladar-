import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Spinner({ rotulo = 'A carregar…' }: { rotulo?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-cream-200 border-t-gold-500" aria-hidden />
      <span className="text-sm">{rotulo}</span>
    </div>
  )
}

export function Vazio({ titulo, texto, children }: { titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="font-display text-xl text-ink-900">{titulo}</p>
      {texto && <p className="max-w-sm text-sm text-muted">{texto}</p>}
      {children}
    </div>
  )
}

export function Aviso({ tipo = 'erro', children }: { tipo?: 'erro' | 'info' | 'ok'; children: ReactNode }) {
  const cores = {
    erro: 'border-ember-500/30 bg-ember-500/10 text-ember-600',
    info: 'border-gold-500/40 bg-gold-200/40 text-ink-900',
    ok: 'border-basil-500/30 bg-basil-500/10 text-basil-600',
  }[tipo]
  return (
    <div role={tipo === 'erro' ? 'alert' : 'status'} className={`rounded-xl border px-3 py-2.5 text-sm ${cores}`}>
      {children}
    </div>
  )
}

export function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <span className="leading-none">
      <span className={`block font-display text-xl tracking-wide ${claro ? 'text-gold-300' : 'text-ink-900'}`}>Bom Paladar</span>
      <span className={`block text-[10px] uppercase tracking-[0.25em] ${claro ? 'text-cream-200/70' : 'text-muted'}`}>Restaurante & Bar</span>
    </span>
  )
}

/** Folha que sobe do fundo do ecrã (telemóvel) ou janela central (ecrã grande). */
export function Folha({ aberta, aoFechar, titulo, children }: { aberta: boolean; aoFechar: () => void; titulo: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  // aoFechar costuma ser uma função nova a cada render (ex.: a cada letra escrita numa nota).
  // Se fosse dependência do efeito, o foco saltava para a folha a cada letra e o teclado do telemóvel fechava.
  const fechar = useRef(aoFechar)
  fechar.current = aoFechar

  useEffect(() => {
    if (!aberta) return
    const anterior = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    const raiz = document.getElementById('root')
    document.body.style.overflow = 'hidden'
    // O resto da página fica inacessível (teclado e leitores de ecrã) enquanto a folha está aberta.
    raiz?.setAttribute('inert', '')
    ref.current?.focus()
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && fechar.current()
    window.addEventListener('keydown', tecla)
    return () => {
      document.body.style.overflow = overflow
      raiz?.removeAttribute('inert')
      window.removeEventListener('keydown', tecla)
      anterior?.focus({ preventScroll: true })
    }
  }, [aberta])

  if (!aberta) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={titulo}>
      <button type="button" className="absolute inset-0 bg-ink-950/60" aria-label="Fechar" onClick={aoFechar} />
      <div
        ref={ref}
        tabIndex={-1}
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-cream-50 pb-[env(safe-area-inset-bottom)] shadow-2xl outline-none sm:max-w-lg sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-cream-200 bg-cream-50/95 px-5 py-3 backdrop-blur">
          <h2 className="font-display text-lg text-ink-900">{titulo}</h2>
          <button type="button" onClick={aoFechar} className="btn -mr-2 min-h-10 px-3 text-muted hover:text-ink-900" aria-label="Fechar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function Quantidade({ valor, aoMudar, min = 1, max = 99, rotulo = 'Quantidade' }: { valor: number; aoMudar: (n: number) => void; min?: number; max?: number; rotulo?: string }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-cream-200 bg-white" role="group" aria-label={rotulo}>
      <button type="button" className="btn min-h-11 w-11 px-0 text-xl" onClick={() => aoMudar(valor - 1)} disabled={valor <= min} aria-label="Menos">
        −
      </button>
      <span className="w-8 text-center text-lg font-semibold tabular-nums" aria-live="polite">
        {valor}
      </span>
      <button type="button" className="btn min-h-11 w-11 px-0 text-xl" onClick={() => aoMudar(valor + 1)} disabled={valor >= max} aria-label="Mais">
        +
      </button>
    </div>
  )
}
