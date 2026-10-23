import { pedacosDoPedido, textoDasNotas, type ItemFalado } from './frase'

// Lê os pedidos novos em voz alta, um de cada vez e pela ordem de chegada:
// sininho (public/sons/sino.mp3) e depois a frase, feita com os pedaços gravados na voz Dinis
// da ElevenLabs (public/voz, índice em public/voz/indice.json).
// As notas são texto livre e não se podem gravar antes: são lidas pela voz portuguesa do próprio
// aparelho (speechSynthesis). Sem voz portuguesa, diz-se "Com nota, veja no ecrã".

export interface PedidoFalado {
  id: string
  mesaNome: string
  notaGeral: string | null
  itens: ItemFalado[]
}

const INTERVALO = 0.06 // segundos entre pedaços

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Voz portuguesa do aparelho (de Portugal, se houver), ou null. */
function vozPortuguesa(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null
  const vozes = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('pt'))
  return vozes.find((v) => v.lang.toLowerCase() === 'pt-pt') ?? vozes[0] ?? null
}

/** Lê um texto com a voz do aparelho; resolve quando acaba (ou ao fim de um tempo máximo, se o aparelho não avisar). */
function falar(texto: string, voz: SpeechSynthesisVoice): Promise<void> {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(texto)
    u.voice = voz
    u.lang = voz.lang
    u.rate = 0.95
    const limite = setTimeout(resolve, 3000 + texto.length * 120)
    u.onend = u.onerror = () => {
      clearTimeout(limite)
      resolve()
    }
    speechSynthesis.speak(u)
  })
}

/** Bip de recurso, se o sininho não carregar. */
function bip(ctx: AudioContext) {
  const agora = ctx.currentTime
  ;[0, 0.18].forEach((atraso, i) => {
    const osc = ctx.createOscillator()
    const ganho = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = i === 0 ? 880 : 1320
    ganho.gain.setValueAtTime(0.0001, agora + atraso)
    ganho.gain.exponentialRampToValueAtTime(0.4, agora + atraso + 0.02)
    ganho.gain.exponentialRampToValueAtTime(0.0001, agora + atraso + 0.35)
    osc.connect(ganho).connect(ctx.destination)
    osc.start(agora + atraso)
    osc.stop(agora + atraso + 0.4)
  })
  return 0.6
}

export class Locutor {
  private ctx: AudioContext | null = null
  private indice: Promise<Record<string, string>> | null = null
  private sons = new Map<string, Promise<AudioBuffer | null>>()
  private fila: Promise<void> = Promise.resolve()
  private lidos = new Set<string>()
  vozLigada = true
  /** Avisa quem está a ser lido (null quando a fila fica parada). */
  aoMudar: (pedidoId: string | null) => void = () => undefined
  /** Avisa quando o som fica ligado ou é suspenso pelo navegador (ex.: ecrã bloqueado). */
  aoMudarEstado: (ativo: boolean) => void = () => undefined

  get ativo() {
    return this.ctx?.state === 'running'
  }

  /**
   * Liga o som. Os navegadores só deixam depois de um toque na página: sem ele, resume() fica
   * pendente, por isso não se espera mais do que um instante. Devolve se o som ficou mesmo ligado.
   */
  async ativar(): Promise<boolean> {
    // Alguns telemóveis (iPhone) só deixam ler com a voz do aparelho se a primeira leitura vier de um toque.
    if ('speechSynthesis' in window && !this.ctx) {
      speechSynthesis.getVoices() // o Chrome só carrega a lista de vozes quando alguém a pede
      speechSynthesis.speak(new SpeechSynthesisUtterance(''))
    }
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.ctx.onstatechange = () => this.aoMudarEstado(this.ativo)
    }
    await Promise.race([this.ctx.resume(), esperar(300)])
    this.indice ??= fetch('/voz/indice.json')
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, string>>) : {}))
      .catch(() => ({}))
    void this.som('/sons/sino.mp3')
    return this.ativo
  }

  private som(url: string): Promise<AudioBuffer | null> {
    let p = this.sons.get(url)
    if (!p) {
      const ctx = this.ctx!
      p = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => ctx.decodeAudioData(b))
        .catch(() => null)
      this.sons.set(url, p)
    }
    return p
  }

  /** Toca os sons colados, um a seguir ao outro; resolve quando o último acaba. */
  private async tocar(buffers: AudioBuffer[]) {
    const ctx = this.ctx!
    let t = ctx.currentTime + 0.05
    for (const b of buffers) {
      const src = ctx.createBufferSource()
      src.buffer = b
      src.connect(ctx.destination)
      src.start(t)
      t += b.duration + INTERVALO
    }
    await esperar((t - ctx.currentTime) * 1000)
  }

  /**
   * Põe um pedido na fila. `dados` pode ainda estar a carregar: a ordem de leitura é a ordem
   * em que anunciar() foi chamado (a dos eventos do Realtime), não a ordem em que os dados chegam.
   */
  anunciar(id: string, dados: Promise<PedidoFalado | null>, repetir = false) {
    if (!this.ativo) return
    if (this.lidos.has(id) && !repetir) return
    this.lidos.add(id)
    // Prepara já os áudios, enquanto o pedido anterior ainda está a ser lido.
    const preparado = dados.then(async (p) => {
      if (!p) return null
      const indice = await this.indice!
      const notas = textoDasNotas(p.itens, p.notaGeral)
      const vozNotas = notas ? vozPortuguesa() : null
      const chaves = this.vozLigada ? pedacosDoPedido(p.mesaNome, p.itens, p.notaGeral, (c) => c in indice, vozNotas !== null) : []
      const voz = await Promise.all(chaves.map((c) => this.som(`/voz/${indice[c]}`)))
      return {
        sino: await this.som('/sons/sino.mp3'),
        voz: voz.filter((b): b is AudioBuffer => b !== null),
        notas: this.vozLigada && notas && vozNotas ? { texto: notas, voz: vozNotas } : null,
      }
    })
    this.fila = this.fila
      .then(async () => {
        const p = await preparado.catch(() => null)
        if (!p) return
        this.aoMudar(id)
        if (p.sino) await this.tocar([p.sino])
        else await esperar(bip(this.ctx!) * 1000)
        if (p.voz.length) await this.tocar(p.voz)
        if (p.notas) await falar(p.notas.texto, p.notas.voz)
        await esperar(400)
      })
      .catch(() => undefined)
      .finally(() => this.aoMudar(null))
  }
}
