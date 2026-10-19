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

export function FolhaPrato({ prato, aoFechar, aoAdicionar }: Props) {
  const [quantidade, setQuantidade] = useState(1)
  const [nota, setNota] = useState('')
  const [opcao, setOpcao] = useState<string | null>(null)
  const [faltaOpcao, setFaltaOpcao] = useState(false)

  useEffect(() => {
    setQuantidade(1)
    setNota('')
    setOpcao(prato?.opcoes.length === 1 ? prato.opcoes[0]! : null)
    setFaltaOpcao(false)
  }, [prato])

  if (!prato) return null

  const porPessoa = prato.unidade === 'p/ pessoa'

  function adicionar() {
    if (!prato) return
    if (prato.opcoes.length > 0 && !opcao) {
      setFaltaOpcao(true)
      return
    }
    aoAdicionar({
      tipo: 'adicionar',
      prato: { id: prato.id, nome: prato.nome, preco: prato.preco, unidade: prato.unidade },
      opcao,
      nota,
      quantidade,
    })
  }

  return (
    <Folha aberta aoFechar={aoFechar} titulo={prato.nome}>
      {prato.foto_url && <img src={prato.foto_url} alt="" className="aspect-[16/10] w-full object-cover" />}
      <div className="flex flex-col gap-5 px-5 py-4">
        <div>
          <p className="text-lg font-semibold">
            {formatarPreco(prato.preco)} {prato.unidade && <span className="text-sm font-normal text-muted">{prato.unidade}</span>}
          </p>
          {prato.descricao && <p className="mt-1 text-muted">{prato.descricao}</p>}
        </div>

        {prato.grupos && prato.grupos.length > 0 && (
          <div className="cartao p-4">
            <p className="mb-2 font-display text-base">O que inclui</p>
            <dl className="flex flex-col gap-2 text-sm">
              {prato.grupos.map((g) => (
                <div key={g.grupo}>
                  <dt className="font-semibold text-ink-900">{g.grupo}</dt>
                  <dd className="text-muted">{g.itens.join(' · ')}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {prato.opcoes.length > 0 && (
          <fieldset>
            <legend className="rotulo">
              Escolha uma opção <span className="text-ember-500">*</span>
            </legend>
            <div className="flex flex-col gap-2">
              {prato.opcoes.map((o) => (
                <label
                  key={o}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 ${
                    opcao === o ? 'border-gold-500 bg-gold-200/40' : 'border-cream-200 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="opcao"
                    value={o}
                    checked={opcao === o}
                    onChange={() => {
                      setOpcao(o)
                      setFaltaOpcao(false)
                    }}
                    className="h-4 w-4 accent-ink-900"
                  />
                  {o}
                </label>
              ))}
            </div>
            {faltaOpcao && (
              <p role="alert" className="mt-2 text-sm text-ember-600">
                Escolha uma opção para continuar.
              </p>
            )}
          </fieldset>
        )}

        <div>
          <label htmlFor="nota-prato" className="rotulo">
            Nota para a cozinha <span className="font-normal text-muted">(opcional)</span>
          </label>
          <textarea
            id="nota-prato"
            className="campo min-h-20 resize-none"
            maxLength={200}
            placeholder={porPessoa ? 'Ex.: 2 adultos e 1 criança' : 'Ex.: sem cebola, sem gelo, bem passado'}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Quantidade valor={quantidade} aoMudar={setQuantidade} rotulo={porPessoa ? 'Pessoas' : 'Quantidade'} />
          {porPessoa && <span className="text-sm text-muted">{quantidade === 1 ? '1 pessoa' : `${quantidade} pessoas`}</span>}
        </div>

        <button type="button" className="btn-primario w-full py-3.5 text-base" onClick={adicionar}>
          Adicionar · {formatarPreco(prato.preco * quantidade)}
        </button>
      </div>
    </Folha>
  )
}
