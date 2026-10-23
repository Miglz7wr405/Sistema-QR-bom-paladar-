// Monta a frase que a voz do painel lê quando chega um pedido, como uma lista de pedaços já gravados
// (public/voz, voz Dinis da ElevenLabs): "Mesa 1 pediu" + "dois" + "Massa Bolonhesa" + "e" + "Mojito".
// As chaves são o texto normalizado, igual ao de scripts/voz/pedacos.py.

export interface ItemFalado {
  nome: string
  opcao: string | null
  quantidade: number
  nota: string | null
}

export function chaveVoz(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export const PEDACO = {
  e: 'e',
  para: 'para',
  pessoas: 'pessoas',
  umaPessoa: 'para uma pessoa',
  comNota: 'com nota veja no ecra',
  maisItens: 'e mais itens veja no ecra',
  novoPedido: 'novo pedido',
} as const

const primeiraPalavra = (s: string) => chaveVoz(s).split(' ')[0] ?? ''

/** "Massa", "Caipirinha", "Cerveja"… pedem "duas"; o resto "dois". */
function feminino(nome: string): boolean {
  return /a$/.test(primeiraPalavra(nome))
}

function numero(q: number, fem: boolean): string | null {
  if (q === 2) return fem ? 'n2f' : 'n2'
  if (q >= 3 && q <= 20) return `n${q}`
  return null
}

/**
 * O que se diz para o produto: com uma opção escolhida, diz-se só a opção quando ela já diz tudo
 * ("Super Bock ou Castle Lite" + "Castle Lite" → "Castle Lite"; "Arroz" + "Arroz de coco" → "Arroz de coco"),
 * senão o nome e a opção ("Cerveja nacional", "Txilar").
 */
function nomeFalado(item: ItemFalado): string[] {
  if (!item.opcao) return [item.nome]
  const nome = chaveVoz(item.nome)
  const agrupa = /\bou\b|,| e /i.test(item.nome)
  const repete = nome.split(' ').includes(primeiraPalavra(item.opcao))
  return agrupa || repete ? [item.opcao] : [item.nome, item.opcao]
}

/**
 * Lista de chaves a tocar. `temAudio` diz se um pedaço está gravado; o que não estiver
 * (prato novo, mesa nova, quantidade acima de 20) é trocado por "e mais itens, veja no ecrã" / "Novo pedido".
 * Com `notasLidas`, as notas vão ser lidas à parte (textoDasNotas) e não se diz "Com nota, veja no ecrã".
 */
export function pedacosDoPedido(
  mesaNome: string,
  itens: ItemFalado[],
  notaGeral: string | null,
  temAudio: (chave: string) => boolean,
  notasLidas = false,
): string[] {
  const mesa = chaveVoz(`${mesaNome} pediu`)
  const saida: string[] = [temAudio(mesa) ? mesa : PEDACO.novoPedido]
  const falados: string[][] = []
  let faltou = false

  for (const item of itens) {
    const nomes = nomeFalado(item).map(chaveVoz)
    let partes: (string | null)[]
    if (/buffet/i.test(item.nome)) {
      partes = item.quantidade === 1 ? [...nomes, PEDACO.umaPessoa] : [...nomes, PEDACO.para, numero(item.quantidade, true), PEDACO.pessoas]
    } else {
      const fem = feminino(item.opcao && nomes.length === 1 ? item.opcao : item.nome)
      partes = item.quantidade === 1 ? nomes : [numero(item.quantidade, fem), ...nomes]
    }
    if (partes.every((p): p is string => p !== null && temAudio(p))) falados.push(partes as string[])
    else faltou = true
  }

  falados.forEach((partes, i) => {
    if (i > 0 && i === falados.length - 1) saida.push(PEDACO.e)
    saida.push(...partes)
  })
  if (faltou) saida.push(PEDACO.maisItens)
  if (!notasLidas && textoDasNotas(itens, notaGeral)) saida.push(PEDACO.comNota)
  return saida
}

/** As notas do cliente, para ler em voz alta: "Nota para Mojito: sem gelo. Nota do pedido: bebidas primeiro." */
export function textoDasNotas(itens: ItemFalado[], notaGeral: string | null): string | null {
  const frases = itens.filter((i) => i.nota?.trim()).map((i) => `Nota para ${i.nome}: ${i.nota!.trim()}.`)
  if (notaGeral?.trim()) frases.push(`Nota do pedido: ${notaGeral.trim()}.`)
  return frases.length ? frases.join(' ').replace(/([.!?])\./g, '$1') : null
}

/** Texto do aviso no ecrã: "2× Massa Bolonhesa · Cerveja nacional (Txilar)". */
export function resumoDoPedido(itens: ItemFalado[]): string {
  return itens.map((i) => `${i.quantidade > 1 ? `${i.quantidade}× ` : ''}${i.nome}${i.opcao ? ` (${i.opcao})` : ''}`).join(' · ')
}
