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
  nota: 'nota',
  notaPara: 'nota para',
  notaDoPedido: 'nota do pedido',
  /** Recepção: a cozinha acabou um pedido de uma mesa sem gravação "Mesa N, pedido pronto". */
  pedidoPronto: 'pedido pronto',
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
 * Lista de chaves a tocar. `temAudio` diz se um pedaço está gravado; o que não estiver
 * (prato novo, mesa nova, quantidade acima de 20) é trocado por "e mais itens, veja no ecrã" / "Novo pedido".
 * As notas comuns gravadas são lidas ("Nota para Mojito: sem gelo"); as outras ficam em "Com nota, veja no ecrã".
 */
export function pedacosDoPedido(mesaNome: string, itens: ItemFalado[], notaGeral: string | null, temAudio: (chave: string) => boolean): string[] {
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

  saida.push(...comE(falados))
  if (faltou) saida.push(PEDACO.maisItens)

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

/** Texto do aviso no ecrã: "2× Massa Bolonhesa · Cerveja nacional (Txilar)". */
export function resumoDoPedido(itens: ItemFalado[]): string {
  return itens.map((i) => `${i.quantidade > 1 ? `${i.quantidade}× ` : ''}${i.nome}${i.opcao ? ` (${i.opcao})` : ''}`).join(' · ')
}
