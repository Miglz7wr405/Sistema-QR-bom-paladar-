"""Corta "Mesa N" das gravações que já existem, para juntar a outras frases: "Mesa nove" + "a cozinha terminou de fazer".

Uso: python3 -I scripts/voz/mesas.py
Escreve public/voz/mesa-<N>.mp3 e acrescenta a chave "mesa N" a public/voz/indice.json.

De onde vem cada "Mesa N":
1. de "Mesa N pediu": antes de "pediu" o "p" faz um silêncio curto, e o que vem antes dele é "Mesa N";
2. se aí não der (ex.: "Mesa um pediu", em que o "m" se cola ao "p"), de "Mesa N, a cozinha está a preparar",
   até à pausa da vírgula.
Uma mesa em que nenhum dos dois dá um corte com duração plausível fica sem pedaço, e a voz diz a frase sem o número.
"""

import json
import pathlib
import re
import subprocess

RAIZ = pathlib.Path(__file__).resolve().parents[2]
VOZ = RAIZ / 'public' / 'voz'
MESAS = 30
FOLGA = 0.05  # margem que cortar.py deixa antes de cada pedaço
PAUSA = 0.12  # silêncio deixado no fim, como a pausa de uma vírgula


def duracao(f: pathlib.Path) -> float:
    return float(subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(f)],
        capture_output=True, text=True, check=True,
    ).stdout)


def silencios(f: pathlib.Path, ruido: str, minimo: float) -> list[tuple[float, float]]:
    r = subprocess.run(
        ['ffmpeg', '-hide_banner', '-nostats', '-i', str(f), '-af', f'silencedetect=noise={ruido}:d={minimo}', '-f', 'null', '-'],
        capture_output=True, text=True, check=True,
    )
    inicios = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', r.stderr)]
    fins = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r.stderr)]
    fins += [duracao(f)] * (len(inicios) - len(fins))
    return [(a, b) for a, b in zip(inicios, fins) if a > FOLGA / 2]  # sem a margem do início


def fim_antes_de_pediu(f: pathlib.Path) -> float | None:
    """Onde acaba "Mesa N" em "Mesa N pediu": o penúltimo silêncio (o último é a margem do fim)."""
    sil = silencios(f, '-30dB', 0.03)
    if len(sil) < 2:
        return None
    (p_ini, p_fim), (fim_ini, _) = sil[-2], sil[-1]
    pediu = fim_ini - p_fim
    return p_ini if 0.18 <= pediu <= 0.40 else None


def fim_antes_da_virgula(f: pathlib.Path) -> float | None:
    """Onde acaba "Mesa N," em "Mesa N, a cozinha está a preparar": o primeiro silêncio, se vier no sítio certo."""
    sil = silencios(f, '-35dB', 0.08)
    if not sil:
        return None
    ini = sil[0][0]
    return ini if 0.35 <= ini <= 1.0 and duracao(f) - sil[0][1] >= 0.8 else None


def main():
    indice_f = VOZ / 'indice.json'
    indice = json.loads(indice_f.read_text())
    for n in range(1, MESAS + 1):
        fontes = [(indice.get(f'mesa {n} pediu'), fim_antes_de_pediu), (indice.get(f'mesa {n} a cozinha esta a preparar'), fim_antes_da_virgula)]
        corte = None
        for ficheiro, achar in fontes:
            if ficheiro and (fim := achar(VOZ / ficheiro)) and 0.3 <= fim - FOLGA <= 1.0:
                corte = (VOZ / ficheiro, fim)
                break
        if not corte:
            print(f'Mesa {n}: sem corte seguro, fica sem pedaço')
            continue
        origem, fim = corte
        nome = f'mesa-{n}.mp3'
        subprocess.run(
            ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(origem), '-t', f'{fim:.3f}',
             '-af', f'apad=pad_dur={PAUSA}', '-ac', '1', '-ar', '22050', '-b:a', '48k', str(VOZ / nome)],
            check=True,
        )
        indice[f'mesa {n}'] = nome
        print(f'Mesa {n}: {fim - FOLGA:.2f} s de {origem.name}')
    indice_f.write_text(json.dumps(dict(sorted(indice.items())), ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
