import { pedacosComecou, pedacosDoPedido, pedacosPronto, type ItemFalado } from './frase'

// Lê os pedidos novos em voz alta, um de cada vez e pela ordem de chegada:
// sininho (public/sons/sino.mp3) e depois a frase, feita com os pedaços gravados na voz Dinis
// da ElevenLabs (public/voz, índice em public/voz/indice.json). Na recepção lê também os avisos
// da cozinha ("a cozinha está a preparar…", "a cozinha terminou de fazer… pode levar à mesa").

export interface PedidoFalado {
  id: string
  mesaNome: string
  notaGeral: string | null
  itens: ItemFalado[]
}

const INTERVALO = 0.06 // segundos entre pedaços

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
    this.enfileirar(
      id,
      dados.then(async (p) => {
        if (!p) return null
        const indice = await this.indice!
        return this.vozLigada ? pedacosDoPedido(p.mesaNome, p.itens, p.notaGeral, (c) => c in indice) : []
      }),
    )
  }

  /**
   * A cozinha carregou "Começar": sininho e "Mesa 9, a cozinha está a preparar: duas Massa Bolonhesa" (uma só vez por pedido).
   * `dados.itens` deve trazer só a comida (o que sai da cozinha), como em anunciarPronto.
   */
  anunciarComecou(id: string, dados: Promise<PedidoFalado | null>) {
    this.anunciarUmaVez(`comecou:${id}`, id, dados, (p, tem) => pedacosComecou(p.mesaNome, p.itens, tem))
  }

  /**
   * A cozinha carregou "Pronto": sininho e "Mesa 9, a cozinha terminou de fazer: duas Massa Bolonhesa. Pode levar à mesa."
   * `dados.itens` deve trazer só a comida (o que sai da cozinha).
   */
  anunciarPronto(id: string, dados: Promise<PedidoFalado | null>) {
    this.anunciarUmaVez(`pronto:${id}`, id, dados, (p, tem) => pedacosPronto(p.mesaNome, p.itens, tem))
  }

  private anunciarUmaVez(chave: string, id: string, dados: Promise<PedidoFalado | null>, frase: (p: PedidoFalado, temAudio: (c: string) => boolean) => string[]) {
    if (!this.ativo || this.lidos.has(chave)) return
    this.lidos.add(chave)
    this.enfileirar(
      id,
      dados.then(async (p) => {
        if (!p) return null
        const indice = await this.indice!
        return this.vozLigada ? frase(p, (c) => c in indice) : []
      }),
    )
  }

  /** Toca o sininho e os pedaços de voz pela ordem da fila; nunca fala por cima de outro anúncio. */
  private enfileirar(id: string, chaves: Promise<string[] | null>) {
    const preparado = chaves.then(async (lista) => {
      if (!lista) return null
      const indice = await this.indice!
      const voz = await Promise.all(lista.map((c) => this.som(`/voz/${indice[c]}`)))
      return { sino: await this.som('/sons/sino.mp3'), voz: voz.filter((b): b is AudioBuffer => b !== null) }
    })
    this.fila = this.fila
      .then(async () => {
        const p = await preparado.catch(() => null)
        if (!p) return
        this.aoMudar(id)
        if (p.sino) await this.tocar([p.sino])
        else await esperar(bip(this.ctx!) * 1000)
        if (p.voz.length) await this.tocar(p.voz)
        await esperar(400)
      })
      .catch(() => undefined)
      .finally(() => this.aoMudar(null))
  }
}
