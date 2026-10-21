"""Lista dos pedaços de frase que a voz do painel usa, e o texto que a ElevenLabs deve dizer.

Uso: python3 -I scripts/voz/pedacos.py [--faltam CARACTERES]
  lê pedacos.json.in, escreve pedacos.json e lotes/loteN.txt;
  com --faltam, escreve também lotes/faltam.txt e lotes/faltam.json: só os pedaços que ainda não estão
  em public/voz/indice.json, os mais pedidos primeiro, até ao limite de caracteres (para quando os créditos
  da ElevenLabs não chegam para tudo).

Cada pedido é lido juntando pedaços já gravados: "Mesa 1 pediu" + "dois" + "Massa Bolonhesa" + "e" + "Mojito".
A chave de cada pedaço é o texto normalizado (minúsculas, sem acentos) — o mesmo que src/lib/frase.ts calcula.
"""

import argparse
import json
import pathlib
import re
import unicodedata

AQUI = pathlib.Path(__file__).resolve().parent
INDICE = AQUI.parents[1] / 'public' / 'voz' / 'indice.json'
PAUSA = '<break time="1.0s" />'
POR_LOTE = 42


def chave(texto: str) -> str:
    s = unicodedata.normalize('NFD', texto.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


# Como dizer nomes que, escritos como no cardápio, a voz leria mal.
FALAR = {
    'Instinto (1 L)': 'Instinto de um litro',
    'Água sem gás 0,5 L': 'Água sem gás pequena',
    'Água sem gás 1,5 L': 'Água sem gás grande',
    'Sumo natural c/ 1 sabor': 'Sumo natural de um sabor',
    'Sumo natural até 2 sabores': 'Sumo natural de dois sabores',
    'Cappy (todos os sabores)': 'Cappy',
    'Breezer (vários sabores)': 'Breezer',
    'Compal (grande)': 'Compal grande',
    'Coca-Cola e outros': 'Coca-Cola',
    'Copo mini (20 ml)': 'Copo mini de pressão',
    'Copo médio (35 ml)': 'Copo médio de pressão',
    'Caneca (50 ml)': 'Caneca de pressão',
    'Buffet 1.500': 'Buffet de mil e quinhentos',
    'Buffet 2.000': 'Buffet de dois mil',
    'Buffet 2.800': 'Buffet de dois mil e oitocentos',
    'J.C. Le Roux': 'J C Le Roux',
    '2M lata (grf)': 'Dois M',
    'Manica (lata)': 'Manica',
    'Tanqueray Nº Ten': 'Tanqueray Ten',
    'Com gás salgada': 'Água com gás salgada',
    'Com gás, outros sabores': 'Água com gás de sabores',
    'Arroz de feijão c/ salsicha': 'Arroz de feijão com salsicha',
    'CRF Reserva': 'C R F Reserva',
}

NUMEROS = {
    '2': 'dois', '2f': 'duas', '3': 'três', '4': 'quatro', '5': 'cinco', '6': 'seis', '7': 'sete', '8': 'oito',
    '9': 'nove', '10': 'dez', '11': 'onze', '12': 'doze', '13': 'treze', '14': 'catorze', '15': 'quinze',
    '16': 'dezasseis', '17': 'dezassete', '18': 'dezoito', '19': 'dezanove', '20': 'vinte',
}

CONECTORES = {
    'e': 'e',
    'para': 'para',
    'pessoas': 'pessoas',
    'para uma pessoa': 'para uma pessoa',
    'com nota veja no ecra': 'Com nota, veja no ecrã.',
    'e mais itens veja no ecra': 'e mais itens, veja no ecrã.',
    'novo pedido': 'Novo pedido.',
}

MESAS = 30

# O que se pede mais (acompanhamentos, cervejas, refrigerantes): gravado primeiro quando faltam pedaços.
PRIORIDADE = [
    'arroz branco', 'arroz de coco', 'arroz de legumes', 'arroz de tomate', 'xima caracata', 'castle lite',
    '2m lata grf', 'laurentina preta', 'txilar', 'manica lata', 'coca zero', 'tonica', 'soda', 'vinho tinto',
    'vinho branco', 'heineken silver', 'super bock', 'savanna dry', 'stella artois', 'arroz de feijao c salsicha',
    'cha preto', 'cha verde', 'dry lemon', 'ginger ale', 'heineken sem alcool', 'com gas salgada',
]


def falar(nome: str) -> str:
    if nome in FALAR:
        return FALAR[nome]
    s = re.sub(r'\s*\(shot\)', '', nome)
    s = re.sub(r'\((Novo|Reserva|Branco)\)', r'\1', s)
    s = s.replace('S. Miguel', 'São Miguel').replace(' c/ ', ' com ')
    return s


def faltam(pedacos: list[dict], limite: int):
    indice = json.loads(INDICE.read_text()) if INDICE.exists() else {}
    ordem = {k: i for i, k in enumerate(PRIORIDADE)}
    lista = sorted((p for p in pedacos if p['chave'] not in indice), key=lambda p: ordem.get(p['chave'], len(ordem)))
    escolhidos: list[dict] = []
    for p in lista:
        texto = f' {PAUSA} '.join(x['falar'] for x in [*escolhidos, p])
        if len(texto) > limite:
            break
        escolhidos.append(p)
    pasta = AQUI / 'lotes'
    (pasta / 'faltam.txt').write_text(f' {PAUSA} '.join(p['falar'] for p in escolhidos))
    (pasta / 'faltam.json').write_text(json.dumps([p['chave'] for p in escolhidos], ensure_ascii=False, indent=1))
    print(f'faltam {len(lista)} pedaços; lotes/faltam.txt leva {len(escolhidos)} ({len((pasta / "faltam.txt").read_text())} caracteres)')


def main():
    args = argparse.ArgumentParser()
    args.add_argument('--faltam', type=int, metavar='CARACTERES')
    opcoes = args.parse_args()
    dados = json.loads((AQUI / 'pedacos.json.in').read_text())
    pedacos: list[dict] = []
    vistos: set[str] = set()

    def juntar(k: str, texto: str, grupo: str):
        if k in vistos:
            return
        vistos.add(k)
        pedacos.append({'chave': k, 'falar': texto, 'grupo': grupo})

    for n in range(1, MESAS + 1):
        juntar(chave(f'Mesa {n} pediu'), f'Mesa {n} pediu', 'mesa')
    for k, t in NUMEROS.items():
        juntar(f'n{k}', t, 'numero')
    for k, t in CONECTORES.items():
        juntar(k, t, 'conector')
    # Pratos com " ou " no nome têm sempre opção: diz-se só a opção escolhida.
    for p in dados['pratos']:
        if re.search(r'\bou\b', p):
            continue
        juntar(chave(p), falar(p), 'prato')
    for o in dados['opcoes']:
        juntar(chave(o), falar(o), 'opcao')

    lotes = [pedacos[i : i + POR_LOTE] for i in range(0, len(pedacos), POR_LOTE)]
    pasta = AQUI / 'lotes'
    pasta.mkdir(exist_ok=True)
    for i, lote in enumerate(lotes, start=1):
        for p in lote:
            p['lote'] = i
        (pasta / f'lote{i}.txt').write_text(f' {PAUSA} '.join(p['falar'] for p in lote))
    (AQUI / 'pedacos.json').write_text(json.dumps(pedacos, ensure_ascii=False, indent=1))
    total = sum(len((pasta / f'lote{i}.txt').read_text()) for i in range(1, len(lotes) + 1))
    print(f'{len(pedacos)} pedaços em {len(lotes)} lotes · {total} caracteres no total')
    if opcoes.faltam:
        faltam(pedacos, opcoes.faltam)


if __name__ == '__main__':
    main()
