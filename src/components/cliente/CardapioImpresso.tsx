import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { quantidadeDoPrato, type LinhaCarrinho } from '../../lib/cart'
import { formatarPreco, formatarPrecoImpresso } from '../../lib/format'
import type { Categoria, Prato } from '../../lib/types'

// O cardápio no telemóvel replica os cartões impressos do restaurante:
// buffets (quadro preto e dourado), pasta/lasanha, cocktails, carta de vinhos e a folha do bar.

type Estilo = 'buffet' | 'pasta' | 'cocktail' | 'vinho' | 'bar'

function estiloDe(nome: string): Estilo {
  if (/buffet/i.test(nome)) return 'buffet'
  if (/pasta|massa|lasanha/i.test(nome)) return 'pasta'
  if (/cocktail/i.test(nome)) return 'cocktail'
  if (/vinho|brancos|verdes|ros[eé]/i.test(nome)) return 'vinho'
  return 'bar'
}

interface Secao {
  categoria: Categoria
  pratos: Prato[]
}

interface Bloco {
  estilo: Estilo
  secoes: Secao[]
}

interface Props {
  categorias: Categoria[]
  pratos: Prato[]
  linhas: LinhaCarrinho[]
  aoPedir: (prato: Prato) => void
}

const ancora = (c: Categoria) => `cat-${c.id}`

/** "Gin" com opções Bulldog, Hendrick's… aparece como no cartão: "Bulldog / Hendrick's / …". */
function nomeImpresso(p: Prato): string {
  return p.opcoes.length > 1 ? p.opcoes.join(' / ') : p.nome
}

/** "Cabriz (Reserva)" -> "Cabriz" + "(Reserva)" a vermelho, como na carta de vinhos. */
function comParenteses(nome: string, classe: string): ReactNode {
  const m = nome.match(/^(.*?)\s*(\([^)]*\))\s*$/)
  if (!m) return nome
  return (
    <>
      {m[1]} <span className={classe}>{m[2]}</span>
    </>
  )
}

export function CardapioImpresso({ categorias, pratos, linhas, aoPedir }: Props) {
  const blocos = useMemo(() => {
    const secoes = categorias
      .map((c) => ({ categoria: c, pratos: pratos.filter((p) => p.category_id === c.id) }))
      .filter((s) => s.pratos.length > 0)
    // Categorias seguidas com o mesmo estilo ficam no mesmo cartão (ex.: Pasta + Lasanhas).
    const lista: Bloco[] = []
    for (const s of secoes) {
      const estilo = estiloDe(s.categoria.nome)
      const ultimo = lista.at(-1)
      if (ultimo && ultimo.estilo === estilo && estilo !== 'buffet') ultimo.secoes.push(s)
      else lista.push({ estilo, secoes: [s] })
    }
    return lista
  }, [categorias, pratos])

  const todas = useMemo(() => blocos.flatMap((b) => b.secoes), [blocos])
  const [ativa, setAtiva] = useState<string | undefined>(todas[0]?.categoria.id)
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visivel) setAtiva(visivel.target.id.replace('cat-', ''))
      },
      { rootMargin: '-120px 0px -60% 0px' },
    )
    todas.forEach((s) => {
      const el = document.getElementById(ancora(s.categoria))
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [todas])

  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>(`[data-cat="${ativa}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [ativa])

  function irPara(c: Categoria) {
    const el = document.getElementById(ancora(c))
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' })
  }

  const qtd = (p: Prato) => quantidadeDoPrato(linhas, p.id)

  return (
    <>
      <nav
        ref={navRef}
        aria-label="Categorias"
        className="sticky top-[64px] z-20 -mx-4 flex gap-2 overflow-x-auto border-b border-gold-500/30 bg-ink-950/95 px-4 py-2.5 backdrop-blur [scrollbar-width:none]"
      >
        {todas.map(({ categoria }) => (
          <button
            key={categoria.id}
            type="button"
            data-cat={categoria.id}
            onClick={() => irPara(categoria)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 font-menu text-xs font-bold uppercase tracking-wide transition ${
              ativa === categoria.id ? 'bg-gold-500 text-ink-950' : 'text-gold-300 ring-1 ring-gold-500/40'
            }`}
          >
            {categoria.nome}
          </button>
        ))}
      </nav>

      <div className="flex flex-col gap-8 py-6">
        {blocos.map((b) => {
          const chave = b.secoes.map((s) => s.categoria.id).join('-')
          switch (b.estilo) {
            case 'buffet':
              return <QuadroBuffet key={chave} secao={b.secoes[0]!} qtd={qtd} aoPedir={aoPedir} />
            case 'pasta':
              return <QuadroPasta key={chave} secoes={b.secoes} qtd={qtd} aoPedir={aoPedir} />
            case 'cocktail':
              return <QuadroCocktail key={chave} secoes={b.secoes} qtd={qtd} aoPedir={aoPedir} />
            case 'vinho':
              return <CartaVinhos key={chave} secoes={b.secoes} qtd={qtd} aoPedir={aoPedir} />
            case 'bar':
              return <FolhaBar key={chave} secoes={b.secoes} qtd={qtd} aoPedir={aoPedir} />
          }
        })}
        <p className="text-center font-menu text-xs italic text-cream-200/70">*Alteração de preços sem aviso prévio</p>
      </div>
    </>
  )
}

interface QuadroProps {
  qtd: (p: Prato) => number
  aoPedir: (p: Prato) => void
}

/** Botão "Pedir já" ao lado de cada item. Mostra quantos já estão no pedido. */
function PedirJa({
  prato,
  qtd,
  aoPedir,
  tom = 'dourado',
  grande,
  compacto,
}: { prato: Prato; tom?: 'dourado' | 'preto'; grande?: boolean; compacto?: boolean } & QuadroProps) {
  const n = qtd(prato)
  if (!prato.disponivel) {
    return <span className="shrink-0 rounded-full bg-ink-600 px-3 py-1.5 font-menu text-xs font-bold uppercase text-white">Esgotado</span>
  }
  const cores = tom === 'dourado' ? 'bg-gold-500 text-ink-950 hover:bg-gold-400' : 'bg-ink-900 text-gold-300 hover:bg-ink-800'
  return (
    <button
      type="button"
      onClick={() => aoPedir(prato)}
      aria-label={`Pedir já: ${prato.nome}${n ? ` (${n} no pedido)` : ''}`}
      className={`relative shrink-0 rounded-full font-menu font-extrabold uppercase tracking-wide shadow-md transition active:scale-95 ${cores} ${
        grande ? 'w-full py-3.5 text-base' : compacto ? 'min-h-9 whitespace-nowrap px-3 text-[11px]' : 'min-h-10 whitespace-nowrap px-4 text-xs'
      }`}
    >
      Pedir já
      {n > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ember-500 px-1 text-[11px] text-white" aria-hidden>
          {n}
        </span>
      )}
    </button>
  )
}

function Assinatura({ claro = true, pequena = false, className = '' }: { claro?: boolean; pequena?: boolean; className?: string }) {
  return (
    <span className={`inline-flex flex-col items-start whitespace-nowrap leading-none ${className}`}>
      <span className={`font-script ${pequena ? 'text-[26px]' : 'text-4xl'} ${claro ? 'text-cream-50' : 'text-ink-900'}`}>Bom Paladar</span>
      <span className={`mt-1 font-menu font-semibold uppercase text-gold-400 ${pequena ? 'text-[7px] tracking-[0.25em]' : 'text-[9px] tracking-[0.3em]'}`}>
        Restaurante &amp; Bar
      </span>
    </span>
  )
}

// Fotos em losango de cada cartão de buffet, recortadas dos cartões impressos.
const FOTOS_BUFFET: Record<number, string[]> = {
  1500: ['/fotos/buffet-1500-1.webp', '/fotos/buffet-1500-2.webp', '/fotos/buffet-1500-3.webp'],
  2000: ['/fotos/buffet-2000-1.webp', '/fotos/buffet-2000-2.webp', '/fotos/buffet-2000-3.webp'],
  2800: ['/fotos/buffet-2800-1.webp', '/fotos/buffet-2800-2.webp', '/fotos/buffet-2800-3.webp'],
}

const LOSANGO = '[clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]'

/** Foto em losango com moldura cinzenta, como nos cartões de buffet. */
function Losango({ src, className = '' }: { src: string; className?: string }) {
  return (
    <div className={`aspect-square bg-ink-600 p-1.5 shadow-lg ${LOSANGO} ${className}`}>
      <img src={src} alt="" loading="lazy" className={`h-full w-full object-cover ${LOSANGO}`} />
    </div>
  )
}

/** Cartão "MENU BUFFET 1.500,00 MTs P/ PESSOA": cabeçalho branco e lista dourada em fundo preto. */
function QuadroBuffet({ secao, qtd, aoPedir }: { secao: Secao } & QuadroProps) {
  return (
    <section id={ancora(secao.categoria)} aria-label={secao.categoria.nome} className="flex flex-col gap-8">
      {secao.pratos.map((p) => {
        const fotos = FOTOS_BUFFET[p.preco] ?? (p.foto_url ? [p.foto_url] : [])
        return (
        <article key={p.id} className={`overflow-hidden rounded-md shadow-2xl ring-1 ring-gold-500/40 ${p.disponivel ? '' : 'opacity-60 grayscale'}`}>
          <header className="flex items-center justify-between gap-3 bg-papel px-5 py-4">
            <div className="shrink-0 rounded-sm bg-ink-900 px-2.5 py-2 ring-2 ring-gold-500">
              <Assinatura pequena />
            </div>
            <div className="text-right">
              <p className="font-didone text-5xl font-extrabold leading-none tracking-tight text-ink-900">MENU</p>
              <p className="font-menu text-2xl font-extrabold leading-tight text-ink-900">BUFFET</p>
              <p className="whitespace-nowrap font-menu text-xs font-extrabold text-ember-600">
                {formatarPrecoImpresso(p.preco).replace(' MT', '')} <span className="text-[10px]">MTs</span> P/ PESSOA
              </p>
            </div>
          </header>
          {fotos.length > 0 && (
            <div className="flex items-start justify-center bg-gradient-to-b from-papel to-cream-200 px-3 pb-4" aria-hidden>
              {fotos.map((f, i) => (
                <Losango key={f} src={f} className={`w-[36%] max-w-40 ${i > 0 ? '-ml-[5%]' : ''} ${i === 1 ? 'mt-[9%]' : ''}`} />
              ))}
            </div>
          )}
          <div className="h-1 bg-gold-500" />
          <div className="bg-ink-900 px-5 pb-5 pt-4 text-gold-300">
            <p className="mb-3 font-menu text-sm font-extrabold uppercase tracking-wide text-cream-50">Pratos principais do buffet</p>
            {p.grupos?.length ? (
              <dl className="flex flex-col gap-3">
                {p.grupos.map((g) => (
                  <div key={g.grupo} className="border-b border-r border-cream-50/60 pb-2 pr-3">
                    <dt className="flex items-center gap-2 font-menu text-xs font-extrabold uppercase text-cream-50">
                      {g.grupo}
                      <span className="h-px flex-1 bg-cream-50/60" aria-hidden />
                    </dt>
                    {g.itens.map((i) => (
                      <dd key={i} className="mt-1 font-menu text-[13px] font-semibold uppercase leading-snug text-gold-300">
                        {i}
                      </dd>
                    ))}
                  </div>
                ))}
              </dl>
            ) : (
              p.descricao && <p className="font-menu text-sm uppercase text-gold-300">{p.descricao}</p>
            )}
            <div className="mt-5">
              <PedirJa prato={p} qtd={qtd} aoPedir={aoPedir} grande />
            </div>
          </div>
        </article>
        )
      })}
    </section>
  )
}

/** Cartão "MENU Pasta" / "Lasanha": foto no cabeçalho, barras pretas com nome dourado, coluna de fotos à direita e lasanha em baixo. */
function QuadroPasta({ secoes, qtd, aoPedir }: { secoes: Secao[] } & QuadroProps) {
  const fotos = secoes.flatMap((s) => s.pratos).filter((p) => p.foto_url)
  return (
    <article className="overflow-hidden rounded-md bg-ink-900 shadow-2xl ring-1 ring-gold-500/40">
      <header className="relative flex min-h-32 items-center justify-end bg-ink-700 px-4 py-4">
        <img
          src="/fotos/pasta-topo.webp"
          alt=""
          aria-hidden
          className="absolute inset-y-0 left-0 h-full w-[44%] object-cover [clip-path:polygon(0_0,100%_0,78%_100%,0_100%)]"
        />
        <div className="relative flex flex-col items-end gap-1">
          <Assinatura pequena />
          <p className="flex items-baseline gap-1.5 leading-none">
            <span className="font-menu text-lg font-extrabold text-cream-50">MENU</span>
            <span className="font-script text-5xl text-gold-400">Pasta</span>
          </p>
        </div>
      </header>
      <div className="h-1 bg-gold-500" />
      <div className="flex gap-2 px-3 py-5">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {secoes.map((s, i) => (
            <section key={s.categoria.id} id={ancora(s.categoria)} aria-label={s.categoria.nome} className="rounded-sm bg-cream-50 p-2.5">
              <h2 className="mb-3 text-center font-script text-4xl text-gold-600">{s.categoria.nome.replace(/^menu\s+/i, '')}</h2>
              <ul className="flex flex-col gap-2.5">
                {s.pratos.map((p) => (
                  <li key={p.id} className={`bg-ink-900 px-2.5 py-2.5 ${p.disponivel ? '' : 'opacity-60'}`}>
                    <div className="border-l-2 border-t-2 border-gold-500 pl-2 pt-1.5">
                      <p className="font-menu text-[13px] font-extrabold uppercase leading-tight text-gold-400">{p.nome}</p>
                      {p.descricao && <p className="mt-1 font-menu text-[11px] lowercase leading-snug text-cream-50">({p.descricao.replace(/\.$/, '')})</p>}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="font-menu text-sm font-extrabold text-gold-300">{formatarPreco(p.preco)}</p>
                        <PedirJa prato={p} qtd={qtd} aoPedir={aoPedir} compacto />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {i === secoes.length - 1 && (
                <img src="/fotos/lasanha-grande.webp" alt="" aria-hidden loading="lazy" className="mt-3 aspect-[15/4] w-full border-2 border-ink-600 object-cover" />
              )}
            </section>
          ))}
        </div>
        {fotos.length > 0 && (
          <div className="flex w-[74px] shrink-0 flex-col gap-2 sm:w-28" aria-hidden>
            {fotos.map((p) => (
              <img key={p.id} src={p.foto_url!} alt="" loading="lazy" className="aspect-[4/5] w-full border-[3px] border-ink-600 bg-ink-600 object-cover" />
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

/** Cartão "MENU Cocktail": fundo cinzento com cartões brancos e pretos alternados. */
function QuadroCocktail({ secoes, qtd, aoPedir }: { secoes: Secao[] } & QuadroProps) {
  return (
    <article className="overflow-hidden rounded-md bg-quadro shadow-2xl ring-1 ring-gold-500/40">
      <header className="flex flex-col items-center gap-1 bg-ink-900 px-5 pb-4 pt-5">
        <Assinatura className="items-center" />
        <p className="mt-2 flex items-baseline gap-2 leading-none">
          <span className="font-menu text-lg font-bold text-cream-50">MENU</span>
          <span className="font-script text-5xl text-gold-400">Cocktail</span>
        </p>
      </header>
      <div className="h-1 bg-gold-500" />
      {secoes.map((s) => (
        <ul key={s.categoria.id} id={ancora(s.categoria)} aria-label={s.categoria.nome} className="flex flex-col gap-3 p-4">
          {s.pratos.map((p, i) => {
            const escuro = i % 2 === 1
            return (
              <li
                key={p.id}
                className={`flex items-center gap-3 px-3 py-3 ${escuro ? 'bg-ink-900 text-cream-50' : 'bg-white text-ink-900'} ${p.disponivel ? '' : 'opacity-60'}`}
              >
                {p.foto_url && <img src={p.foto_url} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-full object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className={`font-menu text-base font-bold leading-tight ${escuro ? 'text-gold-300' : 'text-gold-600'}`}>{p.nome}</p>
                  {p.descricao && <p className="mt-0.5 font-menu text-xs font-semibold leading-snug">{p.descricao.replace(/\.$/, '')}</p>}
                  {p.opcoes.length > 0 && <p className="mt-0.5 font-menu text-xs font-semibold">{p.opcoes.join(' / ')}</p>}
                  <p className="mt-1 font-menu text-base font-extrabold">{formatarPreco(p.preco)}</p>
                </div>
                <PedirJa prato={p} qtd={qtd} aoPedir={aoPedir} tom={escuro ? 'dourado' : 'preto'} />
              </li>
            )
          })}
        </ul>
      ))}
    </article>
  )
}

/** Uma linha com pontinhos até ao preço, como na carta de vinhos e na folha do bar. */
function LinhaPontilhada({ prato, nome, preco, qtd, aoPedir }: { prato: Prato; nome: ReactNode; preco: string } & QuadroProps) {
  return (
    <li className={`flex items-center gap-2 py-2.5 ${prato.disponivel ? '' : 'opacity-50'}`}>
      <div className="flex min-w-0 flex-1 items-end gap-1 font-menu text-xs font-extrabold uppercase leading-tight text-ink-900">
        <span className="min-w-0">{nome}</span>
        <span className="mb-1 min-w-3 flex-1 border-b-2 border-dotted border-ink-900/60" aria-hidden />
        <span className="shrink-0 whitespace-nowrap">{preco}</span>
      </div>
      <PedirJa prato={prato} qtd={qtd} aoPedir={aoPedir} tom="preto" compacto />
    </li>
  )
}

/** "Conheça a nossa Carta de Vinhos": cabeçalho escuro e lista branca com pontinhos. */
function CartaVinhos({ secoes, qtd, aoPedir }: { secoes: Secao[] } & QuadroProps) {
  return (
    <article className="overflow-hidden rounded-md bg-papel shadow-2xl ring-1 ring-gold-500/40">
      <header className="relative overflow-hidden bg-ink-900 px-5 py-6 text-center">
        <img src="/fotos/vinhos.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" aria-hidden />
        <div className="relative">
          <p className="font-menu text-xl font-semibold tracking-wide text-gold-300">CONHEÇA A NOSSA</p>
          <p className="font-script text-5xl leading-tight text-cream-50">Carta de Vinhos</p>
          <p className="mt-2 inline-block bg-[#5a1a1a] px-3 py-1 font-menu text-xs text-cream-50">Descubra um mundo de sabores na nossa carta de vinhos!</p>
        </div>
      </header>
      <div className="flex flex-col gap-4 px-4 py-5">
        {secoes.map((s) => (
          <section key={s.categoria.id} id={ancora(s.categoria)} aria-label={s.categoria.nome}>
            <h2 className="mb-1 font-script text-4xl text-ink-900">{s.categoria.nome}</h2>
            <ul className="divide-y divide-ink-900/10">
              {s.pratos.map((p) => (
                <LinhaPontilhada
                  key={p.id}
                  prato={p}
                  nome={comParenteses(nomeImpresso(p), 'text-ember-600')}
                  preco={formatarPrecoImpresso(p.preco)}
                  qtd={qtd}
                  aoPedir={aoPedir}
                />
              ))}
            </ul>
          </section>
        ))}
        <p className="font-menu text-xs italic text-ink-700">Alteração de preços sem aviso prévio</p>
      </div>
    </article>
  )
}

/** Folha do bar: papel branco, etiquetas pretas (EXTRAS, SOBREMESAS…) e caixas com pontinhos. */
function FolhaBar({ secoes, qtd, aoPedir }: { secoes: Secao[] } & QuadroProps) {
  return (
    <article className="overflow-hidden rounded-md bg-papel px-4 pb-6 pt-5 shadow-2xl ring-1 ring-gold-500/40">
      <header className="mb-2 border-b border-ink-900/30 pb-2">
        <Assinatura claro={false} />
      </header>
      <div className="flex flex-col gap-7 pt-4">
        {secoes.map((s) => (
          <section key={s.categoria.id} id={ancora(s.categoria)} aria-label={s.categoria.nome}>
            <h2 className="relative z-10 mx-auto -mb-3 w-fit -skew-x-6 bg-ink-800 px-5 py-1.5 text-center font-menu text-sm font-extrabold uppercase tracking-wider text-cream-50 shadow">
              {s.categoria.nome}
            </h2>
            <ul className="border-b-2 border-r-2 border-ink-900/70 px-2 pt-4">
              {s.pratos.map((p) => (
                <LinhaPontilhada key={p.id} prato={p} nome={nomeImpresso(p)} preco={formatarPrecoImpresso(p.preco)} qtd={qtd} aoPedir={aoPedir} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  )
}
