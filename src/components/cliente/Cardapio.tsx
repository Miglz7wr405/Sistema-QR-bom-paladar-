import { useEffect, useMemo, useRef, useState } from 'react'
import { formatarPreco } from '../../lib/format'
import type { Categoria, Prato } from '../../lib/types'

interface Props {
  categorias: Categoria[]
  pratos: Prato[]
  aoEscolher: (prato: Prato) => void
}

const id = (c: Categoria) => `cat-${c.id}`

export function Cardapio({ categorias, pratos, aoEscolher }: Props) {
  const secoes = useMemo(
    () =>
      categorias
        .map((c) => ({ categoria: c, pratos: pratos.filter((p) => p.category_id === c.id) }))
        .filter((s) => s.pratos.length > 0),
    [categorias, pratos],
  )
  const [ativa, setAtiva] = useState<string | undefined>(secoes[0]?.categoria.id)
  const navRef = useRef<HTMLDivElement>(null)

  // Marca na barra a categoria que está à vista.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visivel) setAtiva(visivel.target.id.replace('cat-', ''))
      },
      { rootMargin: '-120px 0px -60% 0px' },
    )
    secoes.forEach((s) => {
      const el = document.getElementById(id(s.categoria))
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [secoes])

  useEffect(() => {
    const botao = navRef.current?.querySelector<HTMLElement>(`[data-cat="${ativa}"]`)
    botao?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [ativa])

  function irPara(c: Categoria) {
    const el = document.getElementById(id(c))
    if (!el) return
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 112, behavior: 'smooth' })
  }

  return (
    <>
      <nav
        ref={navRef}
        aria-label="Categorias"
        className="sticky top-[60px] z-20 -mx-4 flex gap-2 overflow-x-auto border-b border-cream-200 bg-cream-50/95 px-4 py-2.5 backdrop-blur [scrollbar-width:none]"
      >
        {secoes.map(({ categoria }) => (
          <button
            key={categoria.id}
            type="button"
            data-cat={categoria.id}
            onClick={() => irPara(categoria)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              ativa === categoria.id ? 'bg-ink-900 text-gold-300' : 'bg-white text-ink-800 ring-1 ring-cream-200'
            }`}
          >
            {categoria.nome}
          </button>
        ))}
      </nav>

      {secoes.map(({ categoria, pratos: lista }) => (
        <section key={categoria.id} id={id(categoria)} aria-labelledby={`${id(categoria)}-t`} className="pt-6">
          <h2 id={`${id(categoria)}-t`} className="mb-3 font-display text-xl text-ink-900">
            {categoria.nome}
          </h2>
          <ul className="flex flex-col gap-3">
            {lista.map((p) => (
              <li key={p.id}>
                <CartaoPrato prato={p} aoEscolher={aoEscolher} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

function CartaoPrato({ prato, aoEscolher }: { prato: Prato; aoEscolher: (p: Prato) => void }) {
  const esgotado = !prato.disponivel
  return (
    <button
      type="button"
      onClick={() => aoEscolher(prato)}
      disabled={esgotado}
      className={`cartao flex w-full items-stretch gap-3 p-3 text-left transition ${
        esgotado ? 'cursor-not-allowed opacity-55 grayscale' : 'hover:border-gold-400 active:scale-[0.99]'
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-ink-900">{prato.nome}</span>
        {prato.descricao && <span className="mt-0.5 line-clamp-2 text-sm text-muted">{prato.descricao}</span>}
        {prato.opcoes.length > 0 && <span className="mt-0.5 line-clamp-1 text-sm text-muted">{prato.opcoes.join(' · ')}</span>}
        <span className="mt-auto flex items-center gap-2 pt-2">
          <span className="font-semibold text-ink-900">{formatarPreco(prato.preco)}</span>
          {prato.unidade && <span className="text-xs text-muted">{prato.unidade}</span>}
          {esgotado && <span className="rounded-full bg-ink-600 px-2 py-0.5 text-xs font-semibold text-white">Esgotado</span>}
        </span>
      </div>
      {prato.foto_url ? (
        <img src={prato.foto_url} alt="" width={96} height={96} loading="lazy" decoding="async" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
      ) : (
        !esgotado && (
          <span className="self-end rounded-full bg-gold-500 px-3 py-1 text-lg font-semibold leading-none text-ink-950" aria-hidden>
            +
          </span>
        )
      )}
    </button>
  )
}
