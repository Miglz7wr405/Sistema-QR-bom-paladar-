import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CardapioImpresso } from '../../components/cliente/CardapioImpresso'
import { FolhaCarrinho } from '../../components/cliente/FolhaCarrinho'
import { FolhaPrato } from '../../components/cliente/FolhaPrato'
import { MeusPedidos } from '../../components/cliente/MeusPedidos'
import { Aviso, Logo, Spinner } from '../../components/ui/Ui'
import { enviarPedido, obterCardapio, obterMesa, obterPedidosDaMesa } from '../../lib/api'
import { carrinhoReducer, contarItens, paraPedido, totalCarrinho, type LinhaCarrinho } from '../../lib/cart'
import { mensagemDeErro } from '../../lib/errors'
import { formatarPreco } from '../../lib/format'
import type { Categoria, MesaInfo, PedidoCliente, Prato } from '../../lib/types'

type Estado =
  | { fase: 'a-carregar' }
  | { fase: 'invalida' }
  | { fase: 'erro'; mensagem: string }
  | { fase: 'pronta'; mesa: MesaInfo; categorias: Categoria[]; pratos: Prato[] }

const INTERVALO_PEDIDOS = 10_000

function carrinhoGuardado(token: string): LinhaCarrinho[] {
  try {
    const bruto = sessionStorage.getItem(`carrinho:${token}`)
    return bruto ? (JSON.parse(bruto) as LinhaCarrinho[]) : []
  } catch {
    return []
  }
}

export function MesaPage() {
  const { token = '' } = useParams()
  const [estado, setEstado] = useState<Estado>({ fase: 'a-carregar' })
  const [separador, setSeparador] = useState<'cardapio' | 'pedidos'>('cardapio')
  const [linhas, dispatch] = useReducer(carrinhoReducer, token, carrinhoGuardado)
  const [pratoAberto, setPratoAberto] = useState<Prato | null>(null)
  const [carrinhoAberto, setCarrinhoAberto] = useState(false)
  const [notaGeral, setNotaGeral] = useState('')
  const [aEnviar, setAEnviar] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [confirmado, setConfirmado] = useState<{ total: number } | null>(null)
  const [pedidos, setPedidos] = useState<PedidoCliente[] | null>(null)
  const enviando = useRef(false)

  const carregar = useCallback(async () => {
    setEstado({ fase: 'a-carregar' })
    try {
      const [mesa, cardapio] = await Promise.all([obterMesa(token), obterCardapio()])
      if (!mesa) return setEstado({ fase: 'invalida' })
      setEstado({ fase: 'pronta', mesa, ...cardapio })
    } catch (e) {
      setEstado({ fase: 'erro', mensagem: mensagemDeErro(e) })
    }
  }, [token])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    try {
      sessionStorage.setItem(`carrinho:${token}`, JSON.stringify(linhas))
    } catch {
      /* sem armazenamento: o carrinho só vive na página */
    }
  }, [linhas, token])

  const atualizarPedidos = useCallback(async () => {
    try {
      setPedidos(await obterPedidosDaMesa(token))
    } catch {
      /* tenta outra vez no próximo ciclo */
    }
  }, [token])

  // "Os meus pedidos": polling simples a cada 10 s enquanto a página está visível.
  useEffect(() => {
    if (estado.fase !== 'pronta') return
    void atualizarPedidos()
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void atualizarPedidos()
    }, INTERVALO_PEDIDOS)
    const aoVoltar = () => document.visibilityState === 'visible' && void atualizarPedidos()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [estado.fase, atualizarPedidos])


  async function enviar() {
    if (enviando.current || linhas.length === 0) return
    enviando.current = true
    setAEnviar(true)
    setErroEnvio(null)
    try {
      const r = await enviarPedido(token, paraPedido(linhas), notaGeral.trim() || null)
      dispatch({ tipo: 'esvaziar' })
      setNotaGeral('')
      setCarrinhoAberto(false)
      setConfirmado({ total: Number(r.total) })
      void atualizarPedidos()
    } catch (e) {
      setErroEnvio(mensagemDeErro(e))
      // Um prato pode ter esgotado entretanto: atualiza o cardápio.
      if ((e as { hint?: string }).hint === 'esgotado') {
        obterCardapio()
          .then((c) => setEstado((s) => (s.fase === 'pronta' ? { ...s, ...c } : s)))
          .catch(() => undefined)
      }
    } finally {
      enviando.current = false
      setAEnviar(false)
    }
  }

  if (estado.fase === 'a-carregar') {
    return (
      <div className="min-h-dvh bg-cream-50">
        <Spinner rotulo="A abrir o cardápio…" />
      </div>
    )
  }

  if (estado.fase === 'invalida') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink-900 px-6 text-center text-cream-50">
        <Logo claro />
        <h1 className="font-display text-2xl text-gold-300">QR Code inválido</h1>
        <p className="max-w-xs text-cream-200">Este código não corresponde a nenhuma mesa. Por favor, chame um empregado.</p>
      </main>
    )
  }

  if (estado.fase === 'erro') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cream-50 px-6 text-center">
        <Logo />
        <Aviso>{estado.mensagem}</Aviso>
        <button type="button" className="btn-primario" onClick={() => void carregar()}>
          Tentar de novo
        </button>
      </main>
    )
  }

  const { mesa, categorias, pratos } = estado
  const nItens = contarItens(linhas)
  const pedidosAbertos = pedidos?.filter((p) => p.estado !== 'cancelado' && p.estado !== 'entregue').length ?? 0

  // "Pedir já": junta ao pedido e abre "O meu pedido"; antes pergunta a opção ou as pessoas, se for preciso.
  function pedirJa(prato: Prato) {
    if (prato.opcoes.length > 1 || prato.unidade === 'p/ pessoa') return setPratoAberto(prato)
    dispatch({
      tipo: 'adicionar',
      prato: { id: prato.id, nome: prato.nome, preco: prato.preco, unidade: prato.unidade },
      opcao: prato.opcoes[0] ?? null,
      nota: '',
      quantidade: 1,
    })
    setCarrinhoAberto(true)
  }

  // Primeira categoria de bebidas (os Cocktails); dali o cliente desce para cervejas, vinhos, sumos…
  const bebidas =
    categorias.find((c) => /cocktail/i.test(c.nome)) ??
    categorias.find((c) => /bebida|refrigerante|sumo|cerveja|água|vinho/i.test(c.nome) && pratos.some((p) => p.category_id === c.id))

  function irParaBebidas() {
    setCarrinhoAberto(false)
    setSeparador('cardapio')
    if (!bebidas) return
    // Espera a folha fechar (e a página voltar a poder rolar) antes de descer até às bebidas.
    window.setTimeout(() => {
      const el = document.getElementById(`cat-${bebidas.id}`)
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' })
    }, 60)
  }

  return (
    <div className="min-h-dvh bg-ink-950 pb-32">
      <header className="sticky top-0 z-30 border-b border-gold-500/40 bg-ink-900 text-cream-50 shadow-md">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between gap-2 px-4">
          <span className="min-w-0 whitespace-nowrap leading-none">
            <span className="block font-script text-[26px] text-cream-50">Bom Paladar</span>
            <span className="block font-menu text-[7px] font-semibold uppercase tracking-[0.25em] text-gold-400">Restaurante &amp; Bar</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap rounded-full bg-gold-500 px-3 py-1 font-menu text-sm font-extrabold uppercase text-ink-950">{mesa.nome}</span>
            <button
              type="button"
              onClick={() => {
                setSeparador(separador === 'cardapio' ? 'pedidos' : 'cardapio')
                window.scrollTo({ top: 0 })
              }}
              className="relative whitespace-nowrap rounded-full px-3 py-1.5 font-menu text-[11px] font-bold uppercase text-gold-300 ring-1 ring-gold-500/60"
            >
              {separador === 'cardapio' ? 'Meus pedidos' : 'Cardápio'}
              {separador === 'cardapio' && pedidosAbertos > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ember-500 px-1 text-[11px] text-white">
                  {pedidosAbertos}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4">
        {separador === 'cardapio' ? (
          <CardapioImpresso categorias={categorias} pratos={pratos} linhas={linhas} aoPedir={pedirJa} />
        ) : (
          <div className="my-4 rounded-2xl bg-cream-50 px-4 pt-2">
            <h1 className="pt-3 font-menu text-lg font-extrabold uppercase">Os meus pedidos</h1>
            <MeusPedidos pedidos={pedidos} aoVerCardapio={() => setSeparador('cardapio')} />
          </div>
        )}
      </div>

      {nItens > 0 && !confirmado && (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-ink-950 via-ink-950/90 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
          <button
            type="button"
            onClick={() => setCarrinhoAberto(true)}
            className="btn mx-auto flex w-full max-w-2xl justify-between rounded-full bg-gold-500 px-5 py-4 font-menu text-base font-extrabold uppercase text-ink-950 shadow-xl hover:bg-gold-400"
          >
            <span className="rounded-full bg-ink-900 px-2.5 py-0.5 text-sm text-gold-300">{nItens}</span>
            <span>Ver o meu pedido</span>
            <span className="tabular-nums">{formatarPreco(totalCarrinho(linhas))}</span>
          </button>
        </div>
      )}


      <FolhaPrato
        prato={pratoAberto}
        aoFechar={() => setPratoAberto(null)}
        aoAdicionar={(acao) => {
          dispatch(acao)
          setPratoAberto(null)
          setCarrinhoAberto(true)
        }}
      />

      <FolhaCarrinho
        aberta={carrinhoAberto}
        aoFechar={() => setCarrinhoAberto(false)}
        aoAdicionarBebida={bebidas ? irParaBebidas : undefined}
        linhas={linhas}
        dispatch={dispatch}
        notaGeral={notaGeral}
        setNotaGeral={setNotaGeral}
        aEnviar={aEnviar}
        erro={erroEnvio}
        aoEnviar={() => void enviar()}
      />

      {confirmado && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-ink-900 px-6 text-center text-cream-50" role="dialog" aria-modal="true" aria-label="Pedido enviado">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-basil-500 text-4xl" aria-hidden>
            ✓
          </span>
          <h1 className="font-script text-6xl text-gold-300">Pedido enviado!</h1>
          <p className="max-w-xs text-cream-200">
            O pedido da <strong className="text-cream-50">{mesa.nome}</strong> chegou à cozinha. Total: {formatarPreco(confirmado.total)}.
          </p>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <button
              type="button"
              className="btn-dourado py-3.5"
              onClick={() => {
                setConfirmado(null)
                setSeparador('cardapio')
              }}
            >
              Pedir mais
            </button>
            <button
              type="button"
              className="btn border border-cream-200/30 py-3.5 text-cream-50"
              onClick={() => {
                setConfirmado(null)
                setSeparador('pedidos')
                window.scrollTo({ top: 0 })
              }}
            >
              Ver os meus pedidos
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
