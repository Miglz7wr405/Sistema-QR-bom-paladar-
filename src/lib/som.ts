import { useCallback, useEffect, useRef, useState } from 'react'
import { Locutor } from './anuncios'

/**
 * Um locutor (sininho e voz) por página, com o som a ligar-se sozinho: logo ao abrir, se a página
 * já teve um toque (por exemplo o do login), ou no primeiro toque em qualquer sítio. Os navegadores
 * não deixam tocar som sem nenhum toque. Se o navegador suspender o som (ecrã bloqueado), volta a
 * ligar no toque seguinte. Usado no painel e no ecrã da cozinha.
 */
export function useLocutor() {
  const ref = useRef<Locutor | null>(null)
  ref.current ??= new Locutor()
  const locutor = ref.current
  const [somAtivo, setSomAtivo] = useState(false)
  const [aLer, setALer] = useState<string | null>(null)

  useEffect(() => {
    locutor.aoMudar = setALer
    locutor.aoMudarEstado = setSomAtivo
  }, [locutor])

  const ativarSom = useCallback(async () => {
    if (await locutor.ativar()) setSomAtivo(true)
  }, [locutor])

  useEffect(() => {
    if (somAtivo) return
    void ativarSom()
    const aoTocar = () => void ativarSom()
    const eventos = ['pointerup', 'touchend', 'click', 'keydown'] as const
    eventos.forEach((e) => document.addEventListener(e, aoTocar, true))
    return () => eventos.forEach((e) => document.removeEventListener(e, aoTocar, true))
  }, [somAtivo, ativarSom])

  return { locutor, somAtivo, aLer, ativarSom }
}
