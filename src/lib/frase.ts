// Monta as frases que a voz lê, como uma lista de pedaços já gravados (public/voz, voz Dinis da
// ElevenLabs): "Mesa 1 pediu" + "dois" + "Massa Bolonhesa" + "e" + "Mojito"; e os avisos da cozinha
// na recepção: "Mesa 9, a cozinha está a preparar" / "Mesa 9, a cozinha terminou de fazer" + comida (+ "Pode levar à mesa").
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
  nota: 'nota',
  notaPara: 'nota para',
  notaDoPedido: 'nota do pedido',
  /** Recepção, para uma mesa sem gravação "Mesa N, a cozinha está a preparar" / "…terminou de fazer". */
  cozinhaAPreparar: 'a cozinha esta a preparar',
  cozinhaTerminou: 'a cozinha terminou de fazer',
  podeLevar: 'pode levar a mesa',
  maisItens: 'e mais itens veja no ecra',
  novoPedido: 'novo pedido',
} as const

const primeiraPalavra = (s: string) => chaveVoz(s).split(' ')[0] ?? ''

/** "Massa", "Caipirinha", "Cerveja"… pedem "duas"; o resto "dois". */
function feminino(nome: string): boolean {
  return /a$/.test(primeiraPalavra(nome))
}

/**
 * A quantidade em pedaços: "n2f" (duas), "n15" (quinze); de 21 a 99 junta dezenas e unidades:
 * 25 → "vinte" + "e" + "cinco", 31 Massas → "trinta" + "e" + "uma". null fora de 2 a 99.
 */
function numero(q: number, fem: boolean): string[] | null {
  if (q === 2) return [fem ? 'n2f' : 'n2']
  if (q >= 3 && q <= 20) return [`n${q}`]
  if (q > 20 && q <= 99) {
    const dezenas = `n${q - (q % 10)}`
    const u = q % 10
    if (u === 0) return [dezenas]
    return [dezenas, PEDACO.e, u === 1 ? (fem ? 'n1f' : 'n1') : u === 2 ? (fem ? 'n2f' : 'n2') : `n${u}`]
  }
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

/** "A, B e C" com o pedaço "e" antes do último. */
function comE(partes: string[][]): string[] {
  return partes.flatMap((p, i) => (i > 0 && i === partes.length - 1 ? [PEDACO.e, ...p] : p))
}

/**
 * As frases de uma nota, se todas estiverem gravadas na voz Dinis ("sem gelo", "sem cebola"…; ver
 * scripts/voz/lotes/notas.txt): "Sem gelo, sem cebola e sem alho" -> ["sem gelo", "sem cebola", "e", "sem alho"].
 * Uma nota com alguma parte por gravar devolve null e a voz diz "Com nota, veja no ecrã".
 */
function frasesDaNota(nota: string, temAudio: (chave: string) => boolean): string[] | null {
  const partes = nota
    .toLowerCase()
    .replace(/\bs\//g, 'sem ')
    .replace(/\bc\//g, 'com ')
    .split(/[,;.!\n+]|\s+e\s+/)
    .map(chaveVoz)
    .filter(Boolean)
  return partes.length > 0 && partes.every(temAudio) ? comE(partes.map((p) => [p])) : null
}

/**
 * Os itens em pedaços: "duas Massa Bolonhesa e Mojito". Um item com algum pedaço por gravar (prato novo,
 * quantidade acima de 99) é trocado por "e mais itens, veja no ecrã" no fim.
 */
export function pedacosDosItens(itens: ItemFalado[], temAudio: (chave: string) => boolean): string[] {
  const falados: string[][] = []
  let faltou = false

  for (const item of itens) {
    const nomes = nomeFalado(item).map(chaveVoz)
    let partes: string[] | null
    if (/buffet/i.test(item.nome)) {
      const n = numero(item.quantidade, true)
      partes = item.quantidade === 1 ? [...nomes, PEDACO.umaPessoa] : n && [...nomes, PEDACO.para, ...n, PEDACO.pessoas]
    } else {
      const n = numero(item.quantidade, feminino(item.opcao && nomes.length === 1 ? item.opcao : item.nome))
      partes = item.quantidade === 1 ? nomes : n && [...n, ...nomes]
    }
    if (partes?.every(temAudio)) falados.push(partes)
    else faltou = true
  }

  return [...comE(falados), ...(faltou ? [PEDACO.maisItens] : [])]
}

/**
 * Lista de chaves a tocar. `temAudio` diz se um pedaço está gravado; o que não estiver
 * (prato novo, mesa nova) é trocado por "e mais itens, veja no ecrã" / "Novo pedido".
 * As notas comuns gravadas são lidas ("Nota para Mojito: sem gelo"); as outras ficam em "Com nota, veja no ecrã".
 */
export function pedacosDoPedido(mesaNome: string, itens: ItemFalado[], notaGeral: string | null, temAudio: (chave: string) => boolean): string[] {
  const mesa = chaveVoz(`${mesaNome} pediu`)
  const saida: string[] = [temAudio(mesa) ? mesa : PEDACO.novoPedido, ...pedacosDosItens(itens, temAudio)]

  let notaPorLer = false
  for (const item of itens) {
    if (!item.nota?.trim()) continue
    const frases = frasesDaNota(item.nota, temAudio)
    const nomes = nomeFalado(item).map(chaveVoz)
    const quem = temAudio(PEDACO.notaPara) && nomes.every(temAudio) ? [PEDACO.notaPara, ...nomes] : [PEDACO.nota]
    if (frases && quem.every(temAudio)) saida.push(...quem, ...frases)
    else notaPorLer = true
  }
  if (notaGeral?.trim()) {
    const frases = frasesDaNota(notaGeral, temAudio)
    if (frases && temAudio(PEDACO.notaDoPedido)) saida.push(PEDACO.notaDoPedido, ...frases)
    else notaPorLer = true
  }
  if (notaPorLer) saida.push(PEDACO.comNota)
  return saida
}

/** "Mesa 9, a cozinha está a preparar" (gravado por mesa) ou, sem gravação da mesa, "A cozinha está a preparar". */
function inicioDaCozinha(mesaNome: string, frase: string, temAudio: (chave: string) => boolean): string[] {
  const daMesa = chaveVoz(`${mesaNome}, ${frase}`)
  return temAudio(daMesa) ? [daMesa] : temAudio(frase) ? [frase] : []
}

/** Recepção, quando a cozinha carrega "Começar": "Mesa 9, a cozinha está a preparar: duas Massa Bolonhesa." */
export function pedacosComecou(mesaNome: string, itens: ItemFalado[], temAudio: (chave: string) => boolean): string[] {
  return [...inicioDaCozinha(mesaNome, PEDACO.cozinhaAPreparar, temAudio), ...pedacosDosItens(itens, temAudio)]
}

/** Recepção, quando a cozinha carrega "Pronto": "Mesa 9, a cozinha terminou de fazer: duas Massa Bolonhesa. Pode levar à mesa." */
export function pedacosPronto(mesaNome: string, itens: ItemFalado[], temAudio: (chave: string) => boolean): string[] {
  return [
    ...inicioDaCozinha(mesaNome, PEDACO.cozinhaTerminou, temAudio),
    ...pedacosDosItens(itens, temAudio),
    ...(temAudio(PEDACO.podeLevar) ? [PEDACO.podeLevar] : []),
  ]
}

/** Texto do aviso no ecrã: "2× Massa Bolonhesa · Cerveja nacional (Txilar)". */
export function resumoDoPedido(itens: ItemFalado[]): string {
  return itens.map((i) => `${i.quantidade > 1 ? `${i.quantidade}× ` : ''}${i.nome}${i.opcao ? ` (${i.opcao})` : ''}`).join(' · ')
}
