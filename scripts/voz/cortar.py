"""Corta os lotes gravados na ElevenLabs em um ficheiro por pedaço e escreve o índice.

Uso: python3 -I scripts/voz/cortar.py <pasta com lote1.mp3, lote2.mp3, ..., faltam.mp3 e/ou notas.mp3>
Escreve public/voz/<n>.mp3 e public/voz/indice.json ({chave: ficheiro}).
faltam.mp3 é a gravação de lotes/faltam.txt (pedacos.py --faltam) e corta-se pela lista lotes/faltam.json;
notas.mp3 é a gravação das notas comuns ("sem gelo", "sem cebola"…) de lotes/notas.txt, cortada por lotes/notas.json;
prontos.mp3 é "Mesa N, pedido pronto" (aviso da cozinha na recepção), de lotes/prontos.txt, cortada por lotes/prontos.json;
cozinha.mp3 é "Mesa N, o pedido já está a ser preparado", "Pode levar à mesa" e os números de 30 a 90, "um" e "uma"
(quantidades de 21 a 99), de lotes/cozinha.txt, cortada por lotes/cozinha.json;
avisos.mp3 é "Mesa N, a cozinha está a preparar" e "Mesa N, a cozinha terminou de fazer" (avisos da cozinha na recepção,
com o número da mesa por extenso para a voz não o ler em espanhol), de lotes/avisos.txt, cortada por lotes/avisos.json.
Cada lote tem de ter tantos trechos de voz como pedaços (separados pelas pausas de 1 s; só pausas de 0,9 s ou mais contam, para não partir nomes como "Sauvignon Blanc Spier"); se não bater, pára.
"""

import json
import pathlib
import re
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parents[2]
PEDACOS = RAIZ / 'scripts' / 'voz' / 'pedacos.json'
FALTAM = RAIZ / 'scripts' / 'voz' / 'lotes' / 'faltam.json'
NOTAS = RAIZ / 'scripts' / 'voz' / 'lotes' / 'notas.json'
PRONTOS = RAIZ / 'scripts' / 'voz' / 'lotes' / 'prontos.json'
COZINHA = RAIZ / 'scripts' / 'voz' / 'lotes' / 'cozinha.json'
AVISOS = RAIZ / 'scripts' / 'voz' / 'lotes' / 'avisos.json'
SAIDA = RAIZ / 'public' / 'voz'
FOLGA = 0.05  # segundos de margem antes e depois de cada trecho


def silencios(ficheiro: pathlib.Path) -> tuple[list[tuple[float, float]], float]:
    r = subprocess.run(
        ['ffmpeg', '-hide_banner', '-nostats', '-i', str(ficheiro), '-af', 'silencedetect=noise=-40dB:d=0.9', '-f', 'null', '-'],
        capture_output=True, text=True, check=True,
    )
    inicios = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', r.stderr)]
    fins = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r.stderr)]
    duracao = float(subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(ficheiro)],
        capture_output=True, text=True, check=True,
    ).stdout)
    if len(fins) < len(inicios):  # silêncio até ao fim do ficheiro
        fins.append(duracao)
    return list(zip(inicios, fins)), duracao


def trechos(ficheiro: pathlib.Path) -> list[tuple[float, float]]:
    """Intervalos com voz: o que fica entre os silêncios."""
    sil, duracao = silencios(ficheiro)
    lista, inicio = [], 0.0
    for a, b in sil:
        if a - inicio > 0.08:
            lista.append((inicio, a))
        inicio = b
    if duracao - inicio > 0.08:
        lista.append((inicio, duracao))
    return lista


def cortar(nome_lote: str, audio: pathlib.Path, chaves: list[str], indice: dict[str, str]):
    partes = trechos(audio)
    if len(partes) != len(chaves):
        sys.exit(f'{nome_lote}: {len(partes)} trechos de voz para {len(chaves)} pedaços — não corta')
    for k, (a, b) in zip(chaves, partes):
        nome = re.sub(r'[^a-z0-9]+', '-', k).strip('-') + '.mp3'
        subprocess.run(
            ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{max(0, a - FOLGA):.3f}', '-to', f'{b + FOLGA:.3f}',
             '-i', str(audio), '-ac', '1', '-ar', '22050', '-b:a', '48k', str(SAIDA / nome)],
            check=True,
        )
        indice[k] = nome
    print(f'{nome_lote}: {len(chaves)} pedaços cortados')


def main():
    pasta = pathlib.Path(sys.argv[1])
    pedacos = json.loads(PEDACOS.read_text())
    SAIDA.mkdir(parents=True, exist_ok=True)
    indice_ficheiro = SAIDA / 'indice.json'
    indice = json.loads(indice_ficheiro.read_text()) if indice_ficheiro.exists() else {}
    for lote in sorted({p['lote'] for p in pedacos}):
        audio = pasta / f'lote{lote}.mp3'
        if not audio.exists():
            print(f'lote {lote}: sem áudio, ignorado')
            continue
        cortar(f'lote {lote}', audio, [p['chave'] for p in pedacos if p['lote'] == lote], indice)
    if (pasta / 'faltam.mp3').exists():
        cortar('faltam', pasta / 'faltam.mp3', json.loads(FALTAM.read_text()), indice)
    if (pasta / 'notas.mp3').exists():
        cortar('notas', pasta / 'notas.mp3', json.loads(NOTAS.read_text()), indice)
    if (pasta / 'prontos.mp3').exists():
        cortar('prontos', pasta / 'prontos.mp3', json.loads(PRONTOS.read_text()), indice)
    if (pasta / 'cozinha.mp3').exists():
        cortar('cozinha', pasta / 'cozinha.mp3', json.loads(COZINHA.read_text()), indice)
    if (pasta / 'avisos.mp3').exists():
        cortar('avisos', pasta / 'avisos.mp3', json.loads(AVISOS.read_text()), indice)
    indice_ficheiro.write_text(json.dumps(dict(sorted(indice.items())), ensure_ascii=False, indent=1))
    print(f'{len(indice)} pedaços no índice')


if __name__ == '__main__':
    main()
