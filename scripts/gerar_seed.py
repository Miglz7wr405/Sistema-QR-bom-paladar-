"""Gera a migração com as 10 mesas e o cardápio real a partir de dados/cardapio.json.

Uso: python3 -I scripts/gerar_seed.py  (escreve supabase/migrations/20261019000002_seed.sql)
"""

import json
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ORIGEM = RAIZ / 'dados' / 'cardapio.json'
DESTINO = RAIZ / 'supabase' / 'migrations' / '20261019000002_seed.sql'

# Linhas do cardápio com vários produtos ao mesmo preço: nome curto e opções legíveis.
OPCOES = {
    'Água com gás salgada / outros sabores': ('Água com gás', ['Com gás salgada', 'Com gás, outros sabores']),
    'Arroz branco / Arroz de coco / Arroz de legumes': ('Arroz', ['Arroz branco', 'Arroz de coco', 'Arroz de legumes']),
    'Arroz de tomate / Arroz de feijão c/ salsicha': ('Arroz de tomate ou de feijão c/ salsicha', ['Arroz de tomate', 'Arroz de feijão c/ salsicha']),
    'Xima / Xima caracata': ('Xima', ['Xima', 'Xima caracata']),
    'Tónica / Soda': ('Tónica ou Soda', ['Tónica', 'Soda']),
    'Chá verde / Chá preto': ('Chá', ['Chá verde', 'Chá preto']),
    'Coca Zero / Dry Lemon / Ginger Ale': ('Coca Zero, Dry Lemon ou Ginger Ale', ['Coca Zero', 'Dry Lemon', 'Ginger Ale']),
    "Brutal / Hunter's Gold / Savanna Dry / Savanna Lemon": ('Sidra', ['Brutal', "Hunter's Gold", 'Savanna Dry', 'Savanna Lemon']),
    'Super Bock / Castle Lite': ('Super Bock ou Castle Lite', ['Super Bock', 'Castle Lite']),
    'Manica (lata) / 2M lata (grf) / Laurentina Preta / Txilar': ('Cerveja nacional', ['Manica (lata)', '2M lata (grf)', 'Laurentina Preta', 'Txilar']),
    'Heineken sem álcool / Stella Artois': ('Heineken sem álcool ou Stella Artois', ['Heineken sem álcool', 'Stella Artois']),
    'Heineken Silver / Castle Double Malt': ('Heineken Silver ou Castle Double Malt', ['Heineken Silver', 'Castle Double Malt']),
    'Tanqueray Nº Ten / Tanqueray Blackcurrant / The Botanist': ('Gin premium', ['Tanqueray Nº Ten', 'Tanqueray Blackcurrant', 'The Botanist']),
    "Bulldog / Hendrick's / Beefeater Pink / Beefeater Orange / Musgrave": ('Gin', ['Bulldog', "Hendrick's", 'Beefeater Pink', 'Beefeater Orange', 'Musgrave']),
    'Streeton Blue / Orange / Pink': ('Gin Streeton', ['Streeton Blue', 'Streeton Orange', 'Streeton Pink']),
    'Inverroche Classic / Verdant / Tanqueray Sevilla': ('Gin Inverroche ou Tanqueray Sevilla', ['Inverroche Classic', 'Inverroche Verdant', 'Tanqueray Sevilla']),
    'Sambuca Black / White (shot)': ('Sambuca (shot)', ['Sambuca Black', 'Sambuca White']),
    'Lovoka de caramelo / Lovoka de chocolate (shot)': ('Lovoka (shot)', ['Lovoka de caramelo', 'Lovoka de chocolate']),
    "Grant's Novo / Ballantine's / Jameson Novo / Dewar's": ('Whisky blended', ["Grant's Novo", "Ballantine's", 'Jameson Novo', "Dewar's"]),
    "Johnnie Walker Black Label / Jameson IPA / Jack Daniel's": ('Whisky Black Label, Jameson IPA ou Jack Daniel\'s', ['Johnnie Walker Black Label', 'Jameson IPA', "Jack Daniel's"]),
    'The Glenfiddich 12 / Jameson Black Barrel': ('Glenfiddich 12 ou Jameson Black Barrel', ['The Glenfiddich 12', 'Jameson Black Barrel']),
    'Johnnie Walker Green Label / Gold Label': ('Johnnie Walker Green ou Gold Label', ['Johnnie Walker Green Label', 'Johnnie Walker Gold Label']),
    '1920 Brandy / Vodka Smirnoff': ('1920 Brandy ou Vodka Smirnoff', ['1920 Brandy', 'Vodka Smirnoff']),
    'CRF Reserva / Hennessy / Rémy Martin': ('Cognac', ['CRF Reserva', 'Hennessy', 'Rémy Martin']),
    'Captain Morgan Black / Gold': ('Captain Morgan', ['Captain Morgan Black', 'Captain Morgan Gold']),
    'Martini Tinto / Branco / Amarula': ('Martini ou Amarula', ['Martini Tinto', 'Martini Branco', 'Amarula']),
    'Tia Maria / Vinho do Porto Ferreira / Licor Beirão': ('Licores e Porto', ['Tia Maria', 'Vinho do Porto Ferreira', 'Licor Beirão']),
    'Sangria de Vinho Branco / Tinto': ('Sangria', ['Vinho branco', 'Vinho tinto']),
}

# Ordem pedida pelo restaurante: Pasta, Lasanhas e só depois os Buffets; o resto como no cardápio.
PRIMEIRO = ['massas', 'lasanhas', 'buffet']

# Itens sem preço no cardápio impresso ficam de fora: não se podem pedir pelo QR.
# Os shots com preço estão na secção "Espirituosas (Gin) / Shots".


def sql(valor):
    if valor is None:
        return 'null'
    if isinstance(valor, (int, float)):
        return str(valor)
    return "'" + str(valor).replace("'", "''") + "'"


def sql_array(valores):
    return 'array[' + ', '.join(sql(v) for v in valores) + ']::text[]' if valores else "'{}'::text[]"


def main():
    dados = json.loads(ORIGEM.read_text())
    linhas = [
        '-- Gerado por scripts/gerar_seed.py a partir de dados/cardapio.json. Não editar à mão.',
        '-- 10 mesas e o cardápio real do Bom Paladar (outubro de 2026).',
        '',
        "insert into public.restaurant_tables (numero, nome)",
        "select n, 'Mesa ' || n from generate_series(1, 10) as n;",
        '',
    ]
    total = 0
    secoes = sorted(dados['secoes'], key=lambda s: PRIMEIRO.index(s['id']) if s['id'] in PRIMEIRO else len(PRIMEIRO))
    for ordem_cat, sec in enumerate(secoes, start=1):
        unidade_sec = {'Dose': 'dose', 'Garrafa': 'garrafa'}.get(sec.get('nota') or '')
        linhas.append(f"insert into public.categories (nome, ordem) values ({sql(sec['nome'])}, {ordem_cat});")
        valores = []
        ordem = 0
        for item in sec['itens']:
            if item['preco'] is None:
                continue
            nome, opcoes = OPCOES.get(item['nome'], (item['nome'], []))
            ordem += 1
            foto = f"/fotos/{item['foto'].rsplit('/', 1)[-1]}.webp" if item.get('foto') else None
            grupos = json.dumps(item['composicao'], ensure_ascii=False) if item.get('composicao') else None
            unidade = 'p/ pessoa' if item.get('unidade') == 'p/ pessoa' else unidade_sec
            valores.append(
                '  (' + ', '.join([
                    sql(nome), sql(item.get('descricao')), sql(item['preco']), sql(unidade),
                    sql_array(opcoes), (sql(grupos) if grupos else 'null') + '::jsonb', sql(foto), str(ordem),
                ]) + ')'
            )
        total += len(valores)
        linhas.append('insert into public.menu_items (category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)')
        linhas.append(f"select c.id, v.* from public.categories c, (values")
        linhas.append(',\n'.join(valores))
        linhas.append(f") as v(nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)")
        linhas.append(f"where c.nome = {sql(sec['nome'])};")
        linhas.append('')
    DESTINO.write_text('\n'.join(linhas))
    print(f'{len(dados["secoes"])} categorias, {total} pratos -> {DESTINO.relative_to(RAIZ)}')


if __name__ == '__main__':
    main()
