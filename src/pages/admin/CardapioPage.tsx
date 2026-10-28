import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { z } from 'zod'
import { Aviso, Folha, Spinner } from '../../components/ui/Ui'
import { mensagemDeErro } from '../../lib/errors'
import { formatarPreco } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Categoria, GrupoBuffet, Prato } from '../../lib/types'

const BUCKET = 'pratos'

const esquemaPrato = z.object({
  nome: z.string().trim().min(1, 'Escreva o nome do prato.').max(120, 'Nome demasiado longo (máximo 120).'),
  descricao: z.string().trim().max(500, 'Descrição demasiado longa (máximo 500).'),
  preco: z.coerce.number({ invalid_type_error: 'Preço inválido.' }).min(0, 'O preço não pode ser negativo.').max(1_000_000, 'Preço demasiado alto.'),
  unidade: z.string().trim().max(30, 'Unidade demasiado longa.'),
  category_id: z.string().uuid('Escolha uma categoria.'),
  opcoes: z.array(z.string().trim().min(1).max(80, 'Cada opção tem no máximo 80 caracteres.')).max(20, 'No máximo 20 opções.'),
})

const nomeCategoria = z.string().trim().min(1, 'Escreva o nome da categoria.').max(60, 'Máximo 60 caracteres.')

/** "Carnes: Bife; Feijoada" por linha <-> [{grupo, itens}] */
function gruposParaTexto(g: GrupoBuffet[] | null): string {
  return (g ?? []).map((x) => `${x.grupo}: ${x.itens.join('; ')}`).join('\n')
}
function textoParaGrupos(t: string): GrupoBuffet[] | null {
  const grupos = t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [grupo = '', resto = ''] = l.includes(':') ? [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1)] : ['', l]
      return { grupo: grupo.trim() || 'Inclui', itens: resto.split(';').map((i) => i.trim()).filter(Boolean) }
    })
    .filter((g) => g.itens.length > 0)
  return grupos.length ? grupos : null
}

type Rascunho = {
  id?: string
  nome: string
  descricao: string
  preco: string
  unidade: string
  category_id: string
  opcoes: string
  grupos: string
  foto_url: string | null
  disponivel: boolean
}

function rascunhoDe(p: Prato | null, categoria: string): Rascunho {
  return {
    id: p?.id,
    nome: p?.nome ?? '',
    descricao: p?.descricao ?? '',
    preco: p ? String(p.preco) : '',
    unidade: p?.unidade ?? '',
    category_id: p?.category_id ?? categoria,
    opcoes: (p?.opcoes ?? []).join('\n'),
    grupos: gruposParaTexto(p?.grupos ?? null),
    foto_url: p?.foto_url ?? null,
    disponivel: p?.disponivel ?? true,
  }
}

export function CardapioPage() {
  const [categorias, setCategorias] = useState<Categoria[] | null>(null)
  const [pratos, setPratos] = useState<Prato[]>([])
  const [catAtiva, setCatAtiva] = useState<string>('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [foto, setFoto] = useState<File | null>(null)
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [novaCat, setNovaCat] = useState('')

  const carregar = useCallback(async () => {
    const [c, p] = await Promise.all([
      supabase.from('categories').select('*').order('ordem'),
      supabase.from('menu_items').select('*').order('ordem'),
    ])
    if (c.error || p.error) return setErro(mensagemDeErro(c.error ?? p.error))
    setCategorias(c.data as Categoria[])
    setPratos((p.data as Prato[]).map((x) => ({ ...x, preco: Number(x.preco) })))
    setCatAtiva((atual) => (atual && c.data.some((x) => x.id === atual) ? atual : (c.data[0]?.id ?? '')))
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function correr(fn: () => PromiseLike<{ error: unknown }>) {
    setOcupado(true)
    setErro(null)
    const { error } = await fn()
    setOcupado(false)
    if (error) {
      setErro(mensagemDeErro(error))
      return false
    }
    await carregar()
    return true
  }

  // Troca a posição com o vizinho (cima/baixo) e renumera a lista.
  function mover<T extends { id: string }>(lista: T[], id: string, dir: -1 | 1, tabela: 'categories' | 'menu_items') {
    const i = lista.findIndex((x) => x.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= lista.length) return
    const nova = [...lista]
    ;[nova[i], nova[j]] = [nova[j]!, nova[i]!]
    void correr(async () => {
      for (const [ordem, x] of nova.entries()) {
        const { error } = await supabase.from(tabela).update({ ordem: ordem + 1 }).eq('id', x.id)
        if (error) return { error }
      }
      return { error: null }
    })
  }

  function adicionarCategoria(e: FormEvent) {
    e.preventDefault()
    const r = nomeCategoria.safeParse(novaCat)
    if (!r.success) return setErro(r.error.issues[0]?.message ?? 'Nome inválido.')
    const ordem = Math.max(0, ...(categorias ?? []).map((c) => c.ordem)) + 1
    void correr(() => supabase.from('categories').insert({ nome: r.data, ordem })).then((ok) => ok && setNovaCat(''))
  }

  function renomearCategoria(c: Categoria) {
    const nome = window.prompt('Novo nome da categoria', c.nome)
    if (nome === null) return
    const r = nomeCategoria.safeParse(nome)
    if (!r.success) return setErro(r.error.issues[0]?.message ?? 'Nome inválido.')
    void correr(() => supabase.from('categories').update({ nome: r.data }).eq('id', c.id))
  }

  function mudarCozinha(c: Categoria) {
    void correr(() => supabase.from('categories').update({ para_cozinha: !c.para_cozinha }).eq('id', c.id))
  }

  function apagarCategoria(c: Categoria) {
    if (pratos.some((p) => p.category_id === c.id)) return setErro(`A categoria “${c.nome}” tem pratos. Mova-os ou apague-os primeiro.`)
    if (!window.confirm(`Apagar a categoria “${c.nome}”?`)) return
    void correr(() => supabase.from('categories').delete().eq('id', c.id))
  }

  async function guardarPrato(e: FormEvent) {
    e.preventDefault()
    if (!rascunho) return
    const opcoes = rascunho.opcoes.split('\n').map((o) => o.trim()).filter(Boolean)
    const r = esquemaPrato.safeParse({ ...rascunho, preco: rascunho.preco.replace(',', '.'), opcoes })
    if (!r.success) return setErroForm(r.error.issues[0]?.message ?? 'Dados inválidos.')
    if (foto && !foto.type.startsWith('image/')) return setErroForm('A foto tem de ser uma imagem.')
    if (foto && foto.size > 5 * 1024 * 1024) return setErroForm('A foto tem no máximo 5 MB.')
    setErroForm(null)
    setOcupado(true)

    let foto_url = rascunho.foto_url
    if (foto) {
      const ext = (foto.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      const caminho = `${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from(BUCKET).upload(caminho, foto, { contentType: foto.type, cacheControl: '31536000' })
      if (up.error) {
        setOcupado(false)
        return setErroForm(`Não foi possível carregar a foto: ${mensagemDeErro(up.error)}`)
      }
      foto_url = supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl
    }

    const dados = {
      nome: r.data.nome,
      descricao: r.data.descricao || null,
      preco: r.data.preco,
      unidade: r.data.unidade || null,
      category_id: r.data.category_id,
      opcoes: r.data.opcoes,
      grupos: textoParaGrupos(rascunho.grupos),
      foto_url,
      disponivel: rascunho.disponivel,
    }
    const ordem = Math.max(0, ...pratos.filter((p) => p.category_id === dados.category_id).map((p) => p.ordem)) + 1
    const { error } = rascunho.id
      ? await supabase.from('menu_items').update(dados).eq('id', rascunho.id)
      : await supabase.from('menu_items').insert({ ...dados, ordem })
    setOcupado(false)
    if (error) return setErroForm(mensagemDeErro(error))
    setRascunho(null)
    setFoto(null)
    await carregar()
  }

  function apagarPrato(p: Prato) {
    if (!window.confirm(`Apagar “${p.nome}” do cardápio? Os pedidos antigos continuam no histórico.`)) return
    void correr(() => supabase.from('menu_items').delete().eq('id', p.id))
  }

  if (!categorias) return erro ? <Aviso>{erro}</Aviso> : <Spinner />

  const lista = pratos.filter((p) => p.category_id === catAtiva)
  const esgotados = pratos.filter((p) => !p.disponivel).length

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Cardápio</h1>
          <p className="text-sm text-muted">
            {pratos.length} pratos em {categorias.length} categorias{esgotados > 0 && ` · ${esgotados} esgotado(s)`}
          </p>
        </div>
        <button
          type="button"
          className="btn-primario"
          disabled={!catAtiva}
          onClick={() => {
            setErroForm(null)
            setFoto(null)
            setRascunho(rascunhoDe(null, catAtiva))
          }}
        >
          + Novo prato
        </button>
      </div>
      {erro && (
        <div className="mb-4">
          <Aviso>{erro}</Aviso>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="cartao h-fit p-3">
          <h2 className="mb-2 px-1 font-display text-lg">Categorias</h2>
          <ul className="flex flex-col gap-1">
            {categorias.map((c, i) => (
              <li key={c.id} className={`flex items-center gap-1 rounded-xl ${catAtiva === c.id ? 'bg-ink-900 text-gold-300' : 'hover:bg-cream-100'}`}>
                <button type="button" className="min-h-10 flex-1 px-3 text-left text-sm font-medium" onClick={() => setCatAtiva(c.id)}>
                  {c.para_cozinha && <span title="Vai para o ecrã da cozinha">🍳 </span>}
                  {c.nome} <span className="opacity-60">({pratos.filter((p) => p.category_id === c.id).length})</span>
                </button>
                {catAtiva === c.id && (
                  <span className="flex shrink-0 pr-1 text-xs">
                    <button type="button" className="h-8 w-7" aria-label="Subir" disabled={ocupado || i === 0} onClick={() => mover(categorias, c.id, -1, 'categories')}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className="h-8 w-7"
                      aria-label="Descer"
                      disabled={ocupado || i === categorias.length - 1}
                      onClick={() => mover(categorias, c.id, 1, 'categories')}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={`h-8 w-7 rounded ${c.para_cozinha ? 'bg-gold-500/30' : 'opacity-50'}`}
                      aria-label={c.para_cozinha ? 'Deixar de enviar para a cozinha' : 'Enviar para a cozinha'}
                      aria-pressed={Boolean(c.para_cozinha)}
                      title={c.para_cozinha ? 'Vai para a cozinha (carregue para tirar)' : 'Não vai para a cozinha (carregue para enviar)'}
                      disabled={ocupado}
                      onClick={() => mudarCozinha(c)}
                    >
                      🍳
                    </button>
                    <button type="button" className="h-8 w-7" aria-label="Renomear" onClick={() => renomearCategoria(c)}>
                      ✎
                    </button>
                    <button type="button" className="h-8 w-7" aria-label="Apagar" onClick={() => apagarCategoria(c)}>
                      🗑
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <form onSubmit={adicionarCategoria} className="mt-3 flex gap-2 border-t border-cream-200 pt-3">
            <input className="campo min-h-10 py-1.5 text-sm" placeholder="Nova categoria" value={novaCat} maxLength={60} onChange={(e) => setNovaCat(e.target.value)} />
            <button type="submit" className="btn-secundario min-h-10 text-sm" disabled={ocupado}>
              Adicionar
            </button>
          </form>
        </aside>

        <section>
          {lista.length === 0 ? (
            <p className="cartao p-6 text-center text-muted">Esta categoria ainda não tem pratos.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lista.map((p, i) => (
                <li key={p.id} className={`cartao flex flex-wrap items-center gap-3 p-3 ${p.disponivel ? '' : 'bg-cream-100'}`}>
                  {p.foto_url ? (
                    <img src={p.foto_url} alt="" className="h-14 w-14 rounded-lg object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-cream-100 text-xs text-muted">sem foto</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {p.nome} {!p.disponivel && <span className="ml-1 rounded-full bg-ink-600 px-2 py-0.5 text-xs text-white">Esgotado</span>}
                    </p>
                    <p className="text-sm text-muted">
                      {formatarPreco(p.preco)} {p.unidade}
                      {p.opcoes.length > 0 && ` · ${p.opcoes.length} opções`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-xl border border-cream-200 bg-white px-3 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-basil-500"
                        checked={p.disponivel}
                        disabled={ocupado}
                        onChange={() => void correr(() => supabase.from('menu_items').update({ disponivel: !p.disponivel }).eq('id', p.id))}
                      />
                      Disponível
                    </label>
                    <button type="button" className="btn-secundario min-h-9 w-9 px-0" aria-label="Subir" disabled={ocupado || i === 0} onClick={() => mover(lista, p.id, -1, 'menu_items')}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn-secundario min-h-9 w-9 px-0"
                      aria-label="Descer"
                      disabled={ocupado || i === lista.length - 1}
                      onClick={() => mover(lista, p.id, 1, 'menu_items')}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn-secundario min-h-9 text-sm"
                      onClick={() => {
                        setErroForm(null)
                        setFoto(null)
                        setRascunho(rascunhoDe(p, catAtiva))
                      }}
                    >
                      Editar
                    </button>
                    <button type="button" className="btn-secundario min-h-9 text-sm text-ember-600" disabled={ocupado} onClick={() => apagarPrato(p)}>
                      Apagar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Folha aberta={rascunho !== null} aoFechar={() => setRascunho(null)} titulo={rascunho?.id ? 'Editar prato' : 'Novo prato'}>
        {rascunho && (
          <form onSubmit={(e) => void guardarPrato(e)} className="flex flex-col gap-4 px-5 py-4" noValidate>
            <div>
              <label htmlFor="p-nome" className="rotulo">
                Nome
              </label>
              <input id="p-nome" className="campo" maxLength={120} value={rascunho.nome} onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })} />
            </div>
            <div>
              <label htmlFor="p-desc" className="rotulo">
                Descrição
              </label>
              <textarea
                id="p-desc"
                className="campo min-h-20"
                maxLength={500}
                value={rascunho.descricao}
                onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="p-preco" className="rotulo">
                  Preço (MT)
                </label>
                <input
                  id="p-preco"
                  className="campo"
                  inputMode="decimal"
                  value={rascunho.preco}
                  onChange={(e) => setRascunho({ ...rascunho, preco: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="p-unidade" className="rotulo">
                  Unidade <span className="font-normal text-muted">(opcional)</span>
                </label>
                <input
                  id="p-unidade"
                  className="campo"
                  placeholder="p/ pessoa, dose, garrafa"
                  maxLength={30}
                  value={rascunho.unidade}
                  onChange={(e) => setRascunho({ ...rascunho, unidade: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label htmlFor="p-cat" className="rotulo">
                Categoria
              </label>
              <select id="p-cat" className="campo" value={rascunho.category_id} onChange={(e) => setRascunho({ ...rascunho, category_id: e.target.value })}>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="p-opcoes" className="rotulo">
                Opções <span className="font-normal text-muted">(uma por linha; o cliente escolhe uma)</span>
              </label>
              <textarea
                id="p-opcoes"
                className="campo min-h-20"
                placeholder={'Super Bock\nCastle Lite'}
                value={rascunho.opcoes}
                onChange={(e) => setRascunho({ ...rascunho, opcoes: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="p-grupos" className="rotulo">
                O que inclui <span className="font-normal text-muted">(buffets; “Grupo: item; item” por linha)</span>
              </label>
              <textarea
                id="p-grupos"
                className="campo min-h-20 text-sm"
                placeholder={'Carnes: Bife na panela; Feijoada\nSobremesas: Pudim'}
                value={rascunho.grupos}
                onChange={(e) => setRascunho({ ...rascunho, grupos: e.target.value })}
              />
            </div>
            <div>
              <span className="rotulo">Foto</span>
              <div className="flex items-center gap-3">
                {(foto || rascunho.foto_url) && (
                  <img src={foto ? URL.createObjectURL(foto) : (rascunho.foto_url ?? '')} alt="" className="h-16 w-16 rounded-lg object-cover" />
                )}
                <input type="file" accept="image/*" aria-label="Escolher foto" className="text-sm" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
                {rascunho.foto_url && !foto && (
                  <button type="button" className="btn-secundario min-h-9 text-sm" onClick={() => setRascunho({ ...rascunho, foto_url: null })}>
                    Tirar foto
                  </button>
                )}
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-5 w-5 accent-basil-500"
                checked={rascunho.disponivel}
                onChange={(e) => setRascunho({ ...rascunho, disponivel: e.target.checked })}
              />
              Disponível (desmarque para “Esgotado”)
            </label>
            {erroForm && <Aviso>{erroForm}</Aviso>}
            <button type="submit" className="btn-primario w-full py-3" disabled={ocupado}>
              {ocupado ? 'A guardar…' : 'Guardar'}
            </button>
          </form>
        )}
      </Folha>
    </>
  )
}
