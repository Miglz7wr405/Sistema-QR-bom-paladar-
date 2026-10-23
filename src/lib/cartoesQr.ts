import QRCode from 'qrcode'

// Cartões de mesa para imprimir: formato A6 (105 × 148 mm), 4 por folha A4.
// Desenhados num canvas a 300 ppp, com as cores e letras dos cardápios impressos.

const LARGURA = 1240 // 105 mm a 300 ppp
const ALTURA = 1748 // 148 mm a 300 ppp

const COR = {
  fundo: '#131315',
  ouro: '#c99a3b',
  ouroClaro: '#ecd08a',
  creme: '#fbf8f1',
  cinza: '#e8dfcb',
}

/** Espera pelas letras do site (sem bloquear mais de 3 s se não houver rede). */
async function carregarLetras() {
  if (!('fonts' in document)) return
  const pedidos = [
    document.fonts.load('140px "Great Vibes"', 'Bom Paladar'),
    document.fonts.load('800 160px Montserrat', 'MESA 0123456789'),
    document.fonts.load('600 40px Montserrat', 'Aponte a câmara'),
  ]
  await Promise.race([Promise.allSettled(pedidos), new Promise((r) => setTimeout(r, 3000))])
}

function textoCentrado(ctx: CanvasRenderingContext2D, texto: string, y: number, fonte: string, cor: string, espacamento = 0) {
  ctx.font = fonte
  ctx.fillStyle = cor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${espacamento}px`
  ctx.fillText(texto, LARGURA / 2, y)
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px'
}

/** Ajusta o tamanho da letra para o texto caber na largura dada. */
function fonteQueCabe(ctx: CanvasRenderingContext2D, texto: string, peso: number, maximo: number, largura: number, familia: string) {
  let tamanho = maximo
  ctx.font = `${peso} ${tamanho}px ${familia}`
  while (ctx.measureText(texto).width > largura && tamanho > 40) {
    tamanho -= 4
    ctx.font = `${peso} ${tamanho}px ${familia}`
  }
  return ctx.font
}

export async function desenharCartao(nomeMesa: string, link: string): Promise<HTMLCanvasElement> {
  await carregarLetras()
  const canvas = document.createElement('canvas')
  canvas.width = LARGURA
  canvas.height = ALTURA
  const ctx = canvas.getContext('2d')!

  // Fundo preto com moldura dourada, como os cartões do restaurante.
  ctx.fillStyle = COR.fundo
  ctx.fillRect(0, 0, LARGURA, ALTURA)
  ctx.strokeStyle = COR.ouro
  ctx.lineWidth = 10
  ctx.strokeRect(45, 45, LARGURA - 90, ALTURA - 90)
  ctx.lineWidth = 3
  ctx.strokeRect(70, 70, LARGURA - 140, ALTURA - 140)

  textoCentrado(ctx, 'Bom Paladar', 290, '150px "Great Vibes", "Brush Script MT", cursive', COR.creme)
  textoCentrado(ctx, 'RESTAURANTE & BAR', 360, '600 38px Montserrat, Arial, sans-serif', COR.ouro, 14)

  ctx.fillStyle = COR.ouro
  ctx.fillRect(LARGURA / 2 - 160, 400, 320, 4)

  const titulo = nomeMesa.toUpperCase()
  textoCentrado(ctx, titulo, 560, fonteQueCabe(ctx, titulo, 800, 150, LARGURA - 220, 'Montserrat, Arial, sans-serif'), COR.ouroClaro, 4)

  // QR Code num quadrado branco.
  const lado = 760
  const x = (LARGURA - lado) / 2
  const y = 630
  ctx.fillStyle = '#ffffff'
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(x - 30, y - 30, lado + 60, lado + 60, 36)
    ctx.fill()
  } else {
    ctx.fillRect(x - 30, y - 30, lado + 60, lado + 60)
  }
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, link, { width: lado, margin: 0, errorCorrectionLevel: 'M', color: { dark: COR.fundo, light: '#ffffff' } })
  ctx.drawImage(qr, x, y, lado, lado)

  textoCentrado(ctx, 'Aponte a câmara para ver', 1495, '700 54px Montserrat, Arial, sans-serif', COR.creme)
  textoCentrado(ctx, 'o cardápio e pedir', 1560, '700 54px Montserrat, Arial, sans-serif', COR.creme)
  textoCentrado(ctx, 'Pague no fim, ao atendente ou no caixa', 1610, '500 32px Montserrat, Arial, sans-serif', COR.cinza)
  await assinatura(ctx, 1658)
  return canvas
}

let logoInsight: Promise<HTMLImageElement | null> | undefined

function carregarLogo() {
  logoInsight ??= new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = '/marca/insight.png'
  })
  return logoInsight
}

/** "Feito por" + logótipo da insight creative agency, centrados no fundo do cartão. */
async function assinatura(ctx: CanvasRenderingContext2D, base: number) {
  const logo = await carregarLogo()
  const texto = 'Feito por'
  ctx.font = '500 24px Montserrat, Arial, sans-serif'
  ctx.fillStyle = COR.cinza
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  if (!logo) {
    textoCentrado(ctx, 'Feito por insight creative agency', base, '500 24px Montserrat, Arial, sans-serif', COR.cinza)
    return
  }
  const alturaLogo = 38
  const larguraLogo = (logo.width / logo.height) * alturaLogo
  const espaco = 14
  const larguraTexto = ctx.measureText(texto).width
  const inicio = (LARGURA - larguraTexto - espaco - larguraLogo) / 2
  ctx.fillText(texto, inicio, base)
  ctx.drawImage(logo, inicio + larguraTexto + espaco, base - alturaLogo + 8, larguraLogo, alturaLogo)
}

function descarregar(url: string, nome: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const nomeFicheiro = (nomeMesa: string) =>
  nomeMesa
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export async function descarregarPng(nomeMesa: string, link: string) {
  const canvas = await desenharCartao(nomeMesa, link)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('Não foi possível criar a imagem.')
  const url = URL.createObjectURL(blob)
  descarregar(url, `QR-${nomeFicheiro(nomeMesa)}.png`)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** PDF A4 com 4 cartões por folha e linhas de corte. */
export async function descarregarPdf(mesas: { nome: string; link: string }[]) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const L = 105
  const A = 148.5
  for (const [i, m] of mesas.entries()) {
    if (i > 0 && i % 4 === 0) pdf.addPage()
    const pos = i % 4
    const x = (pos % 2) * L
    const y = Math.floor(pos / 2) * A
    const canvas = await desenharCartao(m.nome, m.link)
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, L, 148)
    if (pos === 3 || i === mesas.length - 1) {
      // Linhas de corte a tracejado no meio da folha.
      pdf.setDrawColor(170)
      pdf.setLineWidth(0.2)
      pdf.setLineDashPattern([2, 2], 0)
      pdf.line(L, 0, L, 297)
      pdf.line(0, A, 210, A)
    }
  }
  pdf.save('QR-Codes-Bom-Paladar.pdf')
}
