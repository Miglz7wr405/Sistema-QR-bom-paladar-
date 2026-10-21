"""Sininho "tlim-tlim" do painel: dois toques de sino pequeno (parciais inarmónicos com decaimento exponencial).

Uso: python3 -I scripts/voz/sino.py /tmp/sino.wav && ffmpeg -i /tmp/sino.wav -ac 1 -b:a 96k public/sons/sino.mp3
"""
import sys, wave
import numpy as np

SR = 44100
DUR = 1.5

def toque(f0, t0, ganho):
    t = np.arange(int(SR * DUR)) / SR - t0
    on = t >= 0
    t = np.where(on, t, 0)
    # razões de parciais típicas de um sino pequeno / glockenspiel
    parciais = [(1.0, 1.0, 2.2), (2.0, 0.45, 3.5), (2.76, 0.35, 4.5), (5.40, 0.18, 7.0), (8.93, 0.08, 10.0)]
    s = np.zeros_like(t)
    for r, a, d in parciais:
        s += a * np.sin(2 * np.pi * f0 * r * t) * np.exp(-d * t)
    ataque = np.minimum(t / 0.003, 1.0)  # ataque de 3 ms, sem clique
    return ganho * s * ataque * on

s = toque(1318.5, 0.0, 1.0) + toque(1760.0, 0.16, 0.85)  # Mi6 e Lá6
fim = np.linspace(1, 0, int(SR * 0.25))
s[-len(fim):] *= fim
s = s / np.max(np.abs(s)) * 0.7
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((s * 32767).astype(np.int16).tobytes())
