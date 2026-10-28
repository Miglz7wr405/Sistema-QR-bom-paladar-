import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { QrImagem } from '../../components/admin/QrImagem'
import { Aviso, Spinner } from '../../components/ui/Ui'
import { mensagemDeErro } from '../../lib/errors'
import { SITE_URL, supabase } from '../../lib/supabase'

/** Separador "🍳 Cozinha": o link e o QR do ecrã da cozinha, e que categorias vão para lá. */
export function CozinhaLinkPage() {
  const [token, setToken] = useState<string | null>(null)
  const [categorias, setCategorias] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('cozinha_acesso').select('token').eq('id', 1).maybeSingle(),
      supabase.from('categories').select('nome').eq('para_cozinha', true).order('ordem'),
    ]).then(([a, c]) => {
      if (a.error || c.error) return setErro(mensagemDeErro(a.error ?? c.error))
      if (!a.data) return setErro('O link da cozinha ainda não foi criado na base de dados.')
      setToken(a.data.token)
      setCategorias(c.data.map((x) => x.nome))
    })
  }, [])

  const link = token ? `${SITE_URL}/cozinha/${token}` : ''

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setAviso('Link copiado.')
    } catch {
      setAviso('Não foi possível copiar. Selecione o link e copie à mão.')
    }
  }

  async function gerarNovo() {
    if (!window.confirm('Gerar um novo link? O link antigo deixa de funcionar: terá de abrir o novo no tablet da cozinha.')) return
    setOcupado(true)
    setErro(null)
    const novo = await supabase.rpc('gerar_token')
    const r = novo.error ? novo : await supabase.from('cozinha_acesso').update({ token: novo.data as string }).eq('id', 1)
    setOcupado(false)
    if (r.error) return setErro(mensagemDeErro(r.error))
    setToken(novo.data as string)
    setAviso('Novo link criado. Abra-o no tablet da cozinha.')
  }

  if (erro && !token) return <Aviso>{erro}</Aviso>
  if (!token) return <Spinner />

  return (
    <>
      <div className="mb-5">
        <h1 className="font-display text-2xl">🍳 Ecrã da cozinha</h1>
        <p className="text-sm text-muted">
          Os pedidos com comida aparecem na cozinha tal como o cliente os escolheu (opção e notas), sem papel. A cozinha carrega “Começar” e “✓ Pronto”, e a
          recepção é avisada.
        </p>
      </div>
      {erro && (
        <div className="mb-4">
          <Aviso>{erro}</Aviso>
        </div>
      )}
      {aviso && (
        <div className="mb-4">
          <Aviso tipo="ok">{aviso}</Aviso>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-[auto_1fr]">
        <div className="cartao flex flex-col items-center gap-3 p-5">
          <QrImagem texto={link} tamanho={240} rotulo="QR Code do ecrã da cozinha" />
          <p className="text-sm font-semibold">Leia este QR com o tablet da cozinha</p>
        </div>

        <div className="cartao flex flex-col gap-4 p-5">
          <div>
            <p className="rotulo">Link da cozinha</p>
            <p className="break-all rounded-xl border border-cream-200 bg-white px-3 py-2.5 font-mono text-sm">{link}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={link} target="_blank" rel="noreferrer" className="btn-dourado">
              Abrir o ecrã da cozinha
            </a>
            <button type="button" className="btn-secundario" onClick={() => void copiar()}>
              Copiar link
            </button>
            <button type="button" className="btn-secundario text-ember-600" disabled={ocupado} onClick={() => void gerarNovo()}>
              {ocupado ? 'A gerar…' : 'Gerar novo link'}
            </button>
          </div>

          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-800">
            <li>No tablet ou telemóvel da cozinha, leia o QR (ou abra o link) e guarde a página nos favoritos ou no ecrã principal.</li>
            <li>Toque uma vez no ecrã para ligar o som. Deixe-o ligado à corrente, com o volume alto.</li>
            <li>Se o link se perder ou alguém o tiver sem dever, carregue em “Gerar novo link”: o antigo deixa de funcionar.</li>
          </ol>

          <div className="border-t border-cream-200 pt-3 text-sm">
            <p>
              <strong>Vão para a cozinha:</strong> {categorias.length ? categorias.join(', ') : 'nenhuma categoria'}.
            </p>
            <p className="text-muted">
              Para mudar, vá a{' '}
              <Link to="/admin/cardapio" className="underline">
                Cardápio
              </Link>{' '}
              e carregue em 🍳 na categoria. As bebidas ficam com a recepção.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
