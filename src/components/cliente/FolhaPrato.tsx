import { useEffect, useState } from 'react'
import type { AcaoCarrinho } from '../../lib/cart'
import { formatarPreco } from '../../lib/format'
import type { Prato } from '../../lib/types'
import { Folha, Quantidade } from '../ui/Ui'

interface Props {
  prato: Prato | null
  aoFechar: () => void
  aoAdicionar: (acao: Extract<AcaoCarrinho, { tipo: 'adicionar' }>) => void
}

/** Só abre quando é preciso escolher alguma coisa: a opção (ex.: qual cerveja) ou quantas pessoas (buffet). */
export function FolhaPrato({ prato, aoFechar, aoAdicionar }: Props) {
  const [quantidade, setQuantidade] = useState(1)
  const [opcao, setOpcao] = useState<string | null>(null)
  const [faltaOpcao, setFaltaOpcao] = useState(false)

  useEffect(() => {
    setQuantidade(1)
    setOpcao(prato?.opcoes.length === 1 ? prato.opcoes[0]! : null)
    setFaltaOpcao(false)
  }, [prato])

  if (!prato) return null

  const porPessoa = prato.unidade === 'p/ pessoa'

  function pedir() {
    if (!prato) return
    if (prato.opcoes.length > 0 && !opcao) return setFaltaOpcao(true)
    aoAdicionar({
      tipo: 'adicionar',
      prato: { id: prato.id, nome: prato.nome, preco: prato.preco, unidade: prato.unidade },
      opcao,
      nota: '',
      quantidade,
    })
  }

  return (
    <Folha aberta aoFechar={aoFechar} titulo={prato.nome}>
      <div className="flex flex-col gap-6 px-5 py-5">
        <p className="font-menu text-lg font-extrabold">
          {formatarPreco(prato.preco)} {prato.unidade && <span className="text-sm font-semibold text-muted">{prato.unidade}</span>}
        </p>

        {prato.opcoes.length > 0 && (
          <fieldset>
            <legend className="mb-2 font-menu text-sm font-bold uppercase">Qual prefere?</legend>
            <div className="flex flex-wrap gap-2">
              {prato.opcoes.map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={opcao === o}
                  onClick={() => {
                    setOpcao(o)
                    setFaltaOpcao(false)
                  }}
                  className={`min-h-11 rounded-full px-4 font-menu text-sm font-bold transition ${
                    opcao === o ? 'bg-ink-900 text-gold-300' : 'bg-white text-ink-900 ring-1 ring-cream-200'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
            {faltaOpcao && (
              <p role="alert" className="mt-2 text-sm text-ember-600">
                Escolha uma opção.
              </p>
            )}
          </fieldset>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="font-menu text-sm font-bold uppercase">{porPessoa ? 'Quantas pessoas?' : 'Quantidade'}</span>
          <Quantidade valor={quantidade} aoMudar={setQuantidade} rotulo={porPessoa ? 'Pessoas' : 'Quantidade'} />
        </div>

        <button type="button" className="btn w-full rounded-full bg-gold-500 py-4 font-menu text-base font-extrabold uppercase text-ink-950 hover:bg-gold-400" onClick={pedir}>
          Pedir já · {formatarPreco(prato.preco * quantidade)}
        </button>
      </div>
    </Folha>
  )
}
