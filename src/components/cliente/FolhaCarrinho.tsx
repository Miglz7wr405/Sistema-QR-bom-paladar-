import type { Dispatch } from 'react'
import { totalCarrinho, type AcaoCarrinho, type LinhaCarrinho } from '../../lib/cart'
import { formatarPreco } from '../../lib/format'
import { Aviso, Folha, Quantidade } from '../ui/Ui'

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
}

export function FolhaCarrinho({ aberta, aoFechar, linhas, dispatch, notaGeral, setNotaGeral, aEnviar, erro, aoEnviar }: Props) {
  const total = totalCarrinho(linhas)
  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo="O seu pedido">
      <div className="flex flex-col gap-4 px-5 py-4">
        {linhas.length === 0 ? (
          <p className="py-8 text-center text-muted">O carrinho está vazio.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-cream-200">
            {linhas.map((l) => (
              <li key={l.chave} className="flex flex-col gap-2 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{l.prato.nome}</p>
                    {l.opcao && <p className="text-sm text-ink-800">{l.opcao}</p>}
                    {l.nota && <p className="text-sm italic text-ember-600">“{l.nota}”</p>}
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">{formatarPreco(l.prato.preco * l.quantidade)}</p>
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
              </li>
            ))}
          </ul>
        )}

        <div>
          <label htmlFor="nota-geral" className="rotulo">
            Nota para o pedido <span className="font-normal text-muted">(opcional)</span>
          </label>
          <textarea
            id="nota-geral"
            className="campo min-h-16 resize-none"
            maxLength={500}
            placeholder="Ex.: trazer as bebidas primeiro"
            value={notaGeral}
            onChange={(e) => setNotaGeral(e.target.value)}
          />
        </div>

        {erro && <Aviso>{erro}</Aviso>}

        <div className="flex items-center justify-between text-lg">
          <span>Total</span>
          <span className="font-display text-2xl tabular-nums">{formatarPreco(total)}</span>
        </div>
        <button type="button" className="btn-dourado w-full py-4 text-lg" disabled={linhas.length === 0 || aEnviar} onClick={aoEnviar}>
          {aEnviar ? 'A enviar…' : 'Enviar pedido'}
        </button>
        <p className="text-center text-xs text-muted">Paga no fim, ao empregado ou no caixa.</p>
      </div>
    </Folha>
  )
}
