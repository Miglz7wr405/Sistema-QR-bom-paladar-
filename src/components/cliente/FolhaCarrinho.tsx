import { useRef, useState, type Dispatch } from 'react'
import { totalCarrinho, type AcaoCarrinho, type LinhaCarrinho } from '../../lib/cart'
import { useDitado } from '../../lib/ditado'
import { formatarPreco } from '../../lib/format'
import { Aviso, Folha, Quantidade } from '../ui/Ui'
import { BotaoDitar, EstadoDitado } from './BotaoDitar'

interface Props {
  aberta: boolean
  aoFechar: () => void
  linhas: LinhaCarrinho[]
  dispatch: Dispatch<AcaoCarrinho>
  notaGeral: string
  setNotaGeral: (s: string) => void
  aEnviar: boolean
  erro: string | null
  aoEnviar: () => void
  /** Fecha o pedido e leva o cliente às bebidas do cardápio. */
  aoAdicionarBebida?: () => void
}

/** Nota de um item ("sem cebola", "sem gelo"): guarda-se quando o campo perde o foco ou quando acaba o ditado. */
function NotaDaLinha({ linha, dispatch }: { linha: LinhaCarrinho; dispatch: Dispatch<AcaoCarrinho> }) {
  const [texto, setTexto] = useState(linha.nota)
  const [aberta, setAberta] = useState(Boolean(linha.nota))
  const atual = useRef(texto)
  atual.current = texto
  const guardar = () => atual.current.trim() !== linha.nota && dispatch({ tipo: 'nota', chave: linha.chave, nota: atual.current.trim() })
  const ditado = useDitado((t) => {
    atual.current = t
    setTexto(t)
  }, guardar)
  if (!aberta) {
    return (
      <button type="button" className="w-fit text-sm font-semibold text-gold-600 underline underline-offset-2" onClick={() => setAberta(true)}>
        + Adicionar nota
      </button>
    )
  }
  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          className="campo min-h-10 py-1.5 text-sm"
          placeholder="Nota: ex. sem cebola, sem gelo"
          maxLength={200}
          autoFocus={!linha.nota}
          value={texto}
          aria-label={`Nota para ${linha.prato.nome}`}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => { ditado.parar(); guardar() }}
        />
        <BotaoDitar aOuvir={ditado.aOuvir} aoIniciar={() => ditado.iniciar(texto, 200)} aoParar={ditado.parar} />
      </div>
      <EstadoDitado aOuvir={ditado.aOuvir} erro={ditado.erro} />
    </div>
  )
}

export function FolhaCarrinho({ aberta, aoFechar, linhas, dispatch, notaGeral, setNotaGeral, aEnviar, erro, aoEnviar, aoAdicionarBebida }: Props) {
  const total = totalCarrinho(linhas)
  const ditado = useDitado(setNotaGeral)
  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo="O meu pedido">
      <div className="flex flex-col gap-4 px-5 py-4">
        {linhas.length === 0 ? (
          <p className="py-8 text-center text-muted">Ainda não escolheu nada.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-cream-200">
            {linhas.map((l) => (
              <li key={l.chave} className="flex flex-col gap-2 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-menu font-bold uppercase">{l.prato.nome}</p>
                    {l.opcao && <p className="text-sm font-semibold text-ink-800">{l.opcao}</p>}
                  </div>
                  <p className="shrink-0 font-menu font-extrabold tabular-nums">{formatarPreco(l.prato.preco * l.quantidade)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <Quantidade
                    valor={l.quantidade}
                    min={0}
                    aoMudar={(n) => dispatch({ tipo: 'quantidade', chave: l.chave, quantidade: n })}
                    rotulo={l.prato.unidade === 'p/ pessoa' ? 'Pessoas' : 'Quantidade'}
                  />
                  <button type="button" className="btn px-2 text-sm text-ember-600" onClick={() => dispatch({ tipo: 'remover', chave: l.chave })}>
                    Remover
                  </button>
                </div>
                <NotaDaLinha linha={l} dispatch={dispatch} />
              </li>
            ))}
          </ul>
        )}

        {aoAdicionarBebida && (
          <button
            type="button"
            onClick={aoAdicionarBebida}
            className="btn w-full rounded-full border-2 border-ink-900 py-3 font-menu text-base font-extrabold uppercase text-ink-900 hover:bg-ink-900 hover:text-gold-300"
          >
            🍹 Adicionar bebida
          </button>
        )}

        <div>
          <label htmlFor="nota-geral" className="rotulo">
            Nota para o pedido <span className="font-normal text-muted">(opcional: escreva ou fale)</span>
          </label>
          <div className="flex items-start gap-2">
            <textarea
              id="nota-geral"
              className="campo min-h-16 resize-none"
              maxLength={500}
              placeholder="Ex.: trazer as bebidas primeiro"
              value={notaGeral}
              onChange={(e) => setNotaGeral(e.target.value)}
              onBlur={() => ditado.parar()}
            />
            <BotaoDitar aOuvir={ditado.aOuvir} aoIniciar={() => ditado.iniciar(notaGeral, 500)} aoParar={ditado.parar} />
          </div>
          <EstadoDitado aOuvir={ditado.aOuvir} erro={ditado.erro} />
        </div>

        {erro && <Aviso>{erro}</Aviso>}

        <div className="flex items-center justify-between">
          <span className="font-menu font-bold uppercase">Total</span>
          <span className="font-menu text-2xl font-extrabold tabular-nums">{formatarPreco(total)}</span>
        </div>
        <button
          type="button"
          className="btn w-full rounded-full bg-gold-500 py-4 font-menu text-lg font-extrabold uppercase text-ink-950 hover:bg-gold-400"
          disabled={linhas.length === 0 || aEnviar}
          onClick={aoEnviar}
        >
          {aEnviar ? 'A enviar…' : 'Pedir agora'}
        </button>
        <p className="text-center text-xs text-muted">Paga no fim, ao atendente ou no caixa.</p>
      </div>
    </Folha>
  )
}
