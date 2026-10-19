-- Gerado por scripts/gerar_seed.py a partir de dados/cardapio.json. Não editar à mão.
-- 10 mesas e o cardápio real do Bom Paladar (outubro de 2026).

insert into public.restaurant_tables (numero, nome)
select n, 'Mesa ' || n from generate_series(1, 10) as n;

insert into public.categories (nome, ordem) values ('Buffet', 1);
insert into public.menu_items (category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
select c.id, v.* from public.categories c, (values
  ('Buffet 1.500', 'O essencial da cozinha da casa, com bebidas e sobremesa.', 1500, 'p/ pessoa', '{}'::text[], '[{"grupo": "Entradas", "itens": ["Chamuças", "Rissóis"]}, {"grupo": "Bebidas", "itens": ["Água Vumba ou Gurué 1,5 L", "Sumo Compal 1 L", "Refrigerantes de 2 L (Coca-Cola, Fanta e Sprite)"]}, {"grupo": "Carnes", "itens": ["Bife na panela", "Feijoada à Bom Paladar"]}, {"grupo": "Aves", "itens": ["Frango à Zambeziana ou água e sal de galinha cafreal"]}, {"grupo": "Peixes", "itens": ["Peixe pedra ou garoupa grelhado"]}, {"grupo": "Verduras", "itens": ["Quiabo ou couve mal passada"]}, {"grupo": "Guarnições", "itens": ["Batata frita", "Arroz branco", "Arroz de legumes", "Chima (branca)"]}, {"grupo": "Saladas", "itens": ["Salada fria com maionese", "Salada de alface ou pepino com tomate e repolho"]}, {"grupo": "Sobremesas", "itens": ["Mousse de malambe ou pudim"]}]'::jsonb, '/fotos/buffet.webp', 1),
  ('Buffet 2.000', 'Mais carnes e o marisco da casa: camarão e lulas.', 2000, 'p/ pessoa', '{}'::text[], '[{"grupo": "Entradas", "itens": ["Chamuças", "Rissóis", "Coxinhas"]}, {"grupo": "Bebidas", "itens": ["Água Vumba ou Gurué 1,5 L", "Sumo Compal 1 L", "Refrigerantes de 2 L (Coca-Cola, Fanta e Sprite)"]}, {"grupo": "Carnes", "itens": ["Bife na panela", "Guisado de carne de vaca", "Feijoada à Bom Paladar"]}, {"grupo": "Aves", "itens": ["Galinha cafreal ou aviário à Zambeziana", "Água e sal de galinha cafreal ou aviário"]}, {"grupo": "Mariscos e peixes", "itens": ["Peixe grelhado (pedra, garoupa ou cherewa)", "Camarão médio grelhado ou na frigideira", "Lulas grelhadas ou na frigideira"]}, {"grupo": "Verduras", "itens": ["Mucuane de mandioca, quiabo ou couve mal passada"]}, {"grupo": "Guarnições", "itens": ["Batata frita", "Arroz branco", "Arroz de legumes", "Mucapata", "Chima (branca)"]}, {"grupo": "Saladas", "itens": ["Salada fria com maionese", "Salada de alface ou pepino com tomate e repolho"]}, {"grupo": "Sobremesas", "itens": ["Mousse de malambe ou mousse de chocolate"]}]'::jsonb, '/fotos/buffet-mesa.webp', 2),
  ('Buffet 2.800', 'O buffet completo: sopa, cabrito, camarão tigre e lagosta.', 2800, 'p/ pessoa', '{}'::text[], '[{"grupo": "Entradas e cafetaria", "itens": ["Café", "Chá", "Chamuças", "Rissóis", "Casquinhas de caranguejo"]}, {"grupo": "Sopas", "itens": ["Sopa de legumes, abóbora ou feijão"]}, {"grupo": "Bebidas", "itens": ["Água Vumba ou Gurué 1,5 L", "Sumo Compal 1 L", "Sumo natural (servido no jarro com torneira)"]}, {"grupo": "Carnes", "itens": ["Bife na panela (carne importada)", "Cabrito no forno (perna)", "Feijoada à Bom Paladar"]}, {"grupo": "Aves", "itens": ["Galinha cafreal ou aviário à Zambeziana", "Espetada de peito de frango"]}, {"grupo": "Mariscos e peixes", "itens": ["Peixe pedra ou garoupa grelhado com molho de manteiga ou coco", "Camarão tigre grelhado com molho de manteiga ou coco", "Lulas grelhadas", "Lagostas médias grelhadas"]}, {"grupo": "Verduras", "itens": ["Mucuane de mandioca, quiabo ou couve mal passada"]}, {"grupo": "Guarnições", "itens": ["Batata frita", "Arroz branco", "Arroz de coco", "Arroz de legumes", "Mucapata", "Legumes salteados"]}, {"grupo": "Saladas", "itens": ["Salada fria com maionese", "Salada de alface ou pepino", "Salada de atum"]}, {"grupo": "Sobremesas", "itens": ["Bolo gelado ou pudim", "Mousse de malambe", "Frutas"]}]'::jsonb, '/fotos/buffet-variado.webp', 3)
) as v(nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
where c.nome = 'Buffet';

insert into public.categories (nome, ordem) values ('Menu Pasta', 2);
insert into public.menu_items (category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
select c.id, v.* from public.categories c, (values
  ('Massa Tagliatelle Carbonara', 'Peito de frango, salsicha, natas e cogumelos.', 950, null, '{}'::text[], null::jsonb, '/fotos/massa-carbonara.webp', 1),
  ('Massa Fettuccine', 'Peito de frango, cenoura raspada, salsa picada e molho de tomate.', 850, null, '{}'::text[], null::jsonb, '/fotos/massa-fettuccine.webp', 2),
  ('Massa Bolonhesa', 'Esparguete com carne moída e molho de tomate.', 850, null, '{}'::text[], null::jsonb, '/fotos/massa-bolonhesa.webp', 3),
  ('Massa Putanesca de Marisco', 'Lulas, camarão, piri-piri, caranguejo desfiado e coentros.', 1200, null, '{}'::text[], null::jsonb, '/fotos/massa-marisco.webp', 4)
) as v(nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
where c.nome = 'Menu Pasta';

insert into public.categories (nome, ordem) values ('Lasanhas', 3);
insert into public.menu_items (category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
select c.id, v.* from public.categories c, (values
  ('Lasanha de Carne Moída', null, 700, null, '{}'::text[], null::jsonb, '/fotos/lasanha-carne.webp', 1),
  ('Lasanha de Frango Desfiado', null, 700, null, '{}'::text[], null::jsonb, '/fotos/lasanha-frango.webp', 2),
  ('Lasanha de Legumes', null, 500, null, '{}'::text[], null::jsonb, '/fotos/lasanha-legumes.webp', 3)
) as v(nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
where c.nome = 'Lasanhas';

insert into public.categories (nome, ordem) values ('Cocktails', 4);
insert into public.menu_items (category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
select c.id, v.* from public.categories c, (values
  ('Margarita', 'Tequila branca, triple sec, lima e sumo de lima.', 350, null, '{}'::text[], null::jsonb, '/fotos/cocktail-margarita.webp', 1),
  ('Bom Paladar Intense Girl', 'Licor de morango, piña colada, rum e sumo de ananás.', 400, null, '{}'::text[], null::jsonb, '/fotos/cocktail-intense-girl.webp', 2),
  ('Caipirinha', 'Cachaça, lima, maracujá, frutos vermelhos, kiwi, tangerina e xarope de açúcar.', 350, null, '{}'::text[], null::jsonb, '/fotos/cocktail-caipirinha.webp', 3),
  ('Caipirosca', 'Vodka, lima, maracujá, frutos vermelhos, kiwi, tangerina e xarope de açúcar.', 300, null, '{}'::text[], null::jsonb, '/fotos/cocktail-caipirosca.webp', 4),
  ('Mojito', 'Rum branco, lima, hortelã, Sprite ou água tónica.', 300, null, '{}'::text[], null::jsonb, '/fotos/cocktail-mojito.webp', 5),
  ('Tequila Sunrise', 'Tequila branca, sumo de laranja e grenadine.', 500, null, '{}'::text[], null::jsonb, '/fotos/cocktail-tequila-sunrise.webp', 6),
  ('Gin Tónico à Bom Paladar', null, 400, null, '{}'::text[], null::jsonb, '/fotos/cocktail-gin-tonico.webp', 7),
  ('Sexy on the Beach', 'Vodka, licor de pêssego e sumo de laranja.', 400, null, '{}'::text[], null::jsonb, '/fotos/cocktail-sexy-on-the-beach.webp', 8),
  ('Blue Lagoon', 'Vodka, licor Blue Curaçao, sumo de limão e Sprite.', 300, null, '{}'::text[], null::jsonb, '/fotos/cocktail-blue-lagoon.webp', 9),
  ('Blue Hawaii', 'Vodka, licor de pêssego, licor Piña Curaçao e Sprite.', 350, null, '{}'::text[], null::jsonb, '/fotos/cocktail-blue-hawaii.webp', 10),
  ('Piña Colada', 'Rum branco, cocktail base de piña colada e sumo de ananás.', 450, null, '{}'::text[], null::jsonb, '/fotos/cocktail-pina-colada.webp', 11),
  ('Caipirinha de Cerveja à Bom Paladar', null, 400, null, '{}'::text[], null::jsonb, '/fotos/cocktail-caipirinha-cerveja.webp', 12),
  ('Sangria', 'Aguardente de cana, triple sec, xarope de menta, brandy, vinho e Sprite.', 800, null, array['Vinho branco', 'Vinho tinto']::text[], null::jsonb, '/fotos/sangria.webp', 13)
) as v(nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
where c.nome = 'Cocktails';

insert into public.categories (nome, ordem) values ('Vinhos Tintos', 5);
insert into public.menu_items (category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
select c.id, v.* from public.categories c, (values
  ('Silk and Spice', null, 2100, 'garrafa', '{}'::text[], null::jsonb, null, 1),
  ('Cabriz (Novo)', null, 1400, 'garrafa', '{}'::text[], null::jsonb, null, 2),
  ('Cabriz (Reserva)', null, 2800, 'garrafa', '{}'::text[], null::jsonb, null, 3),
  ('Mucho Más', null, 2800, 'garrafa', '{}'::text[], null::jsonb, null, 4),
  ('Cadão (Novo)', null, 1400, 'garrafa', '{}'::text[], null::jsonb, null, 5),
  ('Cadão (Reserva)', null, 2200, 'garrafa', '{}'::text[], null::jsonb, null, 6),
  ('Reguengos (Reserva)', null, 2600, 'garrafa', '{}'::text[], null::jsonb, null, 7),
  ('Segredos de S. Miguel (Novo)', null, 1700, 'garrafa', '{}'::text[], null::jsonb, null, 8),
  ('Segredos de S. Miguel (Reserva)', null, 3500, 'garrafa', '{}'::text[], null::jsonb, null, 9),
  ('Duas Quintas', null, 3500, 'garrafa', '{}'::text[], null::jsonb, null, 10),
  ('Pé Tinto', null, 1400, 'garrafa', '{}'::text[], null::jsonb, null, 11),
  ('Portada', null, 1400, 'garrafa', '{}'::text[], null::jsonb, null, 12),
  ('Quinta da Bolota Prestige', null, 2200, 'garrafa', '{}'::text[], null::jsonb, null, 13),
  ('The Chocolate Block', null, 3000, 'garrafa', '{}'::text[], null::jsonb, null, 14),
  ('Spylano', null, 1800, 'garrafa', '{}'::text[], null::jsonb, null, 15),
  ('Casa de Santar', null, 2400, 'garrafa', '{}'::text[], null::jsonb, null, 16),
  ('Dona Vitória', null, 2200, 'garrafa', '{}'::text[], null::jsonb, null, 17),
  ('Herdade de S. Miguel', null, 4800, 'garrafa', '{}'::text[], null::jsonb, null, 18),
  ('Casa da Ínsua', null, 3200, 'garrafa', '{}'::text[], null::jsonb, null, 19),
  ('Instinto (1 L)', null, 1300, 'garrafa', '{}'::text[], null::jsonb, null, 20)
) as v(nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
where c.nome = 'Vinhos Tintos';

insert into public.categories (nome, ordem) values ('Brancos, Verdes & Rosé', 6);
insert into public.menu_items (category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
select c.id, v.* from public.categories c, (values
  ('Robertson Winery Branco', null, 1100, 'garrafa', '{}'::text[], null::jsonb, null, 1),
  ('Aveleda Alvarinho', null, 1500, 'garrafa', '{}'::text[], null::jsonb, null, 2),
  ('Aveleda Fonte', null, 1500, 'garrafa', '{}'::text[], null::jsonb, null, 3),
  ('Fleur du Cap', null, 1250, 'garrafa', '{}'::text[], null::jsonb, null, 4),
  ('Pacheca', null, 1700, 'garrafa', '{}'::text[], null::jsonb, null, 5),
  ('Casal Garcia Branco', null, 1200, 'garrafa', '{}'::text[], null::jsonb, null, 6),
  ('Casal Garcia Verde', null, 1500, 'garrafa', '{}'::text[], null::jsonb, null, 7),
  ('Nederburg Lyric (Branco)', null, 1250, 'garrafa', '{}'::text[], null::jsonb, null, 8),
  ('Quinta da Bolota Verde', null, 1000, 'garrafa', '{}'::text[], null::jsonb, null, 9),
  ('Portada Branco', null, 1300, 'garrafa', '{}'::text[], null::jsonb, null, 10),
  ('Chardonnay Verde', null, 1200, 'garrafa', '{}'::text[], null::jsonb, null, 11),
  ('Sauvignon Blanc Spier', null, 1200, 'garrafa', '{}'::text[], null::jsonb, null, 12),
  ('Petusco Verde', null, 1500, 'garrafa', '{}'::text[], null::jsonb, null, 13),
  ('Robertson Rosé', null, 1250, 'garrafa', '{}'::text[], null::jsonb, null, 14),
  ('Pluma Verde', null, 1200, 'garrafa', '{}'::text[], null::jsonb, null, 15)
) as v(nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
where c.nome = 'Brancos, Verdes & Rosé';

insert into public.categories (nome, ordem) values ('Extras', 7);
insert into public.menu_items (category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
select c.id, v.* from public.categories c, (values
  ('Arroz', null, 200, null, array['Arroz branco', 'Arroz de coco', 'Arroz de legumes']::text[], null::jsonb, null, 1),
  ('Arroz de tomate ou de feijão c/ salsicha', null, 300, null, array['Arroz de tomate', 'Arroz de feijão c/ salsicha']::text[], null::jsonb, null, 2),
  ('Xima', null, 200, null, array['Xima', 'Xima caracata']::text[], null::jsonb, null, 3),
  ('Legumes salteados', null, 200, null, '{}'::text[], null::jsonb, null, 4),
  ('Feijão preto', null, 200, null, '{}'::text[], null::jsonb, null, 5),
  ('Salada mista', null, 200, null, '{}'::text[], null::jsonb, null, 6)
) as v(nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
where c.nome = 'Extras';

insert into public.categories (nome, ordem) values ('Sobremesas', 8);
insert into public.menu_items (category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
select c.id, v.* from public.categories c, (values
  ('Pudim de ovos', null, 250, null, '{}'::text[], null::jsonb, null, 1),
  ('Mousse de malambe', null, 250, null, '{}'::text[], null::jsonb, null, 2),
  ('Salada de frutas da época', null, 300, null, '{}'::text[], null::jsonb, null, 3)
) as v(nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
where c.nome = 'Sobremesas';

insert into public.categories (nome, ordem) values ('Águas / Cafetaria', 9);
insert into public.menu_items (category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
select c.id, v.* from public.categories c, (values
  ('Água sem gás 0,5 L', null, 50, null, '{}'::text[], null::jsonb, null, 1),
  ('Água sem gás 1,5 L', null, 120, null, '{}'::text[], null::jsonb, null, 2),
  ('Água com gás', null, 120, null, array['Com gás salgada', 'Com gás, outros sabores']::text[], null::jsonb, null, 3),
  ('Tónica ou Soda', null, 100, null, array['Tónica', 'Soda']::text[], null::jsonb, null, 4),
  ('Café expresso', null, 100, null, '{}'::text[], null::jsonb, null, 5),
  ('Chá', null, 200, null, array['Chá verde', 'Chá preto']::text[], null::jsonb, null, 6)
) as v(nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
where c.nome = 'Águas / Cafetaria';

insert into public.categories (nome, ordem) values ('Refrigerantes e Sumos', 10);
insert into public.menu_items (category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
select c.id, v.* from public.categories c, (values
  ('Coca Zero, Dry Lemon ou Ginger Ale', null, 100, null, array['Coca Zero', 'Dry Lemon', 'Ginger Ale']::text[], null::jsonb, null, 1),
  ('Coca-Cola e outros', null, 100, null, '{}'::text[], null::jsonb, null, 2),
  ('Red Bull', null, 200, null, '{}'::text[], null::jsonb, null, 3),
  ('Guaraná', null, 100, null, '{}'::text[], null::jsonb, null, 4),
  ('Cappy (todos os sabores)', null, 100, null, '{}'::text[], null::jsonb, null, 5),
  ('Compal (grande)', null, 200, null, '{}'::text[], null::jsonb, null, 6),
  ('Sumo natural c/ 1 sabor', null, 200, null, '{}'::text[], null::jsonb, null, 7),
  ('Sumo natural até 2 sabores', null, 250, null, '{}'::text[], null::jsonb, null, 8)
) as v(nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
where c.nome = 'Refrigerantes e Sumos';

insert into public.categories (nome, ordem) values ('Sidras', 11);
insert into public.menu_items (category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
select c.id, v.* from public.categories c, (values
  ('Sidra', null, 150, null, array['Brutal', 'Hunter''s Gold', 'Savanna Dry', 'Savanna Lemon']::text[], null::jsonb, null, 1),
  ('Bernini', null, 200, null, '{}'::text[], null::jsonb, null, 2),
  ('Breezer (vários sabores)', null, 150, null, '{}'::text[], null::jsonb, null, 3)
) as v(nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
where c.nome = 'Sidras';

insert into public.categories (nome, ordem) values ('Cerveja de Pressão Super Bock', 12);
insert into public.menu_items (category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
select c.id, v.* from public.categories c, (values
  ('Copo mini (20 ml)', null, 140, null, '{}'::text[], null::jsonb, null, 1),
  ('Copo médio (35 ml)', null, 190, null, '{}'::text[], null::jsonb, null, 2),
  ('Caneca (50 ml)', null, 250, null, '{}'::text[], null::jsonb, null, 3)
) as v(nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
where c.nome = 'Cerveja de Pressão Super Bock';

insert into public.categories (nome, ordem) values ('Cervejas Lata / Garrafa', 13);
insert into public.menu_items (category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
select c.id, v.* from public.categories c, (values
  ('Super Bock ou Castle Lite', null, 120, null, array['Super Bock', 'Castle Lite']::text[], null::jsonb, null, 1),
  ('Cerveja nacional', null, 100, null, array['Manica (lata)', '2M lata (grf)', 'Laurentina Preta', 'Txilar']::text[], null::jsonb, null, 2),
  ('Heineken Mini', null, 130, null, '{}'::text[], null::jsonb, null, 3),
  ('Heineken sem álcool ou Stella Artois', null, 160, null, array['Heineken sem álcool', 'Stella Artois']::text[], null::jsonb, null, 4),
  ('Corona', null, 140, null, '{}'::text[], null::jsonb, null, 5),
  ('Heineken Silver ou Castle Double Malt', null, 160, null, array['Heineken Silver', 'Castle Double Malt']::text[], null::jsonb, null, 6)
) as v(nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
where c.nome = 'Cervejas Lata / Garrafa';

insert into public.categories (nome, ordem) values ('Espumantes', 14);
insert into public.menu_items (category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
select c.id, v.* from public.categories c, (values
  ('Annabelle', null, 1600, 'garrafa', '{}'::text[], null::jsonb, null, 1),
  ('Tosti Moscato', null, 1700, 'garrafa', '{}'::text[], null::jsonb, null, 2),
  ('J.C. Le Roux', null, 1300, 'garrafa', '{}'::text[], null::jsonb, null, 3),
  ('Espumante sem álcool', null, 1200, 'garrafa', '{}'::text[], null::jsonb, null, 4)
) as v(nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
where c.nome = 'Espumantes';

insert into public.categories (nome, ordem) values ('Espirituosas (Gin) / Shots', 15);
insert into public.menu_items (category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
select c.id, v.* from public.categories c, (values
  ('Gordon''s Gin', null, 100, 'dose', '{}'::text[], null::jsonb, null, 1),
  ('Tanqueray London Dry', null, 170, 'dose', '{}'::text[], null::jsonb, null, 2),
  ('Gin premium', null, 240, 'dose', array['Tanqueray Nº Ten', 'Tanqueray Blackcurrant', 'The Botanist']::text[], null::jsonb, null, 3),
  ('Gin', null, 170, 'dose', array['Bulldog', 'Hendrick''s', 'Beefeater Pink', 'Beefeater Orange', 'Musgrave']::text[], null::jsonb, null, 4),
  ('Gin Streeton', null, 150, 'dose', array['Streeton Blue', 'Streeton Orange', 'Streeton Pink']::text[], null::jsonb, null, 5),
  ('Gin Inverroche ou Tanqueray Sevilla', null, 180, 'dose', array['Inverroche Classic', 'Inverroche Verdant', 'Tanqueray Sevilla']::text[], null::jsonb, null, 6),
  ('Beefeater London', null, 150, 'dose', '{}'::text[], null::jsonb, null, 7),
  ('Bombay Sapphire', null, 170, 'dose', '{}'::text[], null::jsonb, null, 8),
  ('Sambuca (shot)', null, 250, 'dose', array['Sambuca Black', 'Sambuca White']::text[], null::jsonb, null, 9),
  ('Blow Job (shot)', null, 250, 'dose', '{}'::text[], null::jsonb, null, 10),
  ('Jägermeister (shot)', null, 250, 'dose', '{}'::text[], null::jsonb, null, 11),
  ('Lovoka (shot)', null, 250, 'dose', array['Lovoka de caramelo', 'Lovoka de chocolate']::text[], null::jsonb, null, 12),
  ('Tequila Cactus Jack Azul (shot)', null, 250, 'dose', '{}'::text[], null::jsonb, null, 13),
  ('Tequila Olmeca Silver (shot)', null, 170, 'dose', '{}'::text[], null::jsonb, null, 14)
) as v(nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
where c.nome = 'Espirituosas (Gin) / Shots';

insert into public.categories (nome, ordem) values ('Whisky Blended / Scotch e Single Malt', 16);
insert into public.menu_items (category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
select c.id, v.* from public.categories c, (values
  ('Whisky blended', null, 125, 'dose', array['Grant''s Novo', 'Ballantine''s', 'Jameson Novo', 'Dewar''s']::text[], null::jsonb, null, 1),
  ('Johnnie Walker Red Label', null, 125, 'dose', '{}'::text[], null::jsonb, null, 2),
  ('Whisky Black Label, Jameson IPA ou Jack Daniel''s', null, 180, 'dose', array['Johnnie Walker Black Label', 'Jameson IPA', 'Jack Daniel''s']::text[], null::jsonb, null, 3),
  ('Glenfiddich 12 ou Jameson Black Barrel', null, 230, 'dose', array['The Glenfiddich 12', 'Jameson Black Barrel']::text[], null::jsonb, null, 4),
  ('Johnnie Walker Green ou Gold Label', null, 330, 'dose', array['Johnnie Walker Green Label', 'Johnnie Walker Gold Label']::text[], null::jsonb, null, 5),
  ('The Glenfiddich 15', null, 280, 'dose', '{}'::text[], null::jsonb, null, 6),
  ('Chivas 12 anos', null, 200, 'dose', '{}'::text[], null::jsonb, null, 7)
) as v(nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
where c.nome = 'Whisky Blended / Scotch e Single Malt';

insert into public.categories (nome, ordem) values ('Aguardentes / Digestivos e Cognac', 17);
insert into public.menu_items (category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
select c.id, v.* from public.categories c, (values
  ('1920 Brandy ou Vodka Smirnoff', null, 150, 'dose', array['1920 Brandy', 'Vodka Smirnoff']::text[], null::jsonb, null, 1),
  ('São Domingos', null, 150, 'dose', '{}'::text[], null::jsonb, null, 2),
  ('Cognac', null, 270, 'dose', array['CRF Reserva', 'Hennessy', 'Rémy Martin']::text[], null::jsonb, null, 3),
  ('Vodka Absolut', null, 200, 'dose', '{}'::text[], null::jsonb, null, 4),
  ('Captain Morgan', null, 150, 'dose', array['Captain Morgan Black', 'Captain Morgan Gold']::text[], null::jsonb, null, 5),
  ('Martini ou Amarula', null, 150, 'dose', array['Martini Tinto', 'Martini Branco', 'Amarula']::text[], null::jsonb, null, 6),
  ('Licores e Porto', null, 200, 'dose', array['Tia Maria', 'Vinho do Porto Ferreira', 'Licor Beirão']::text[], null::jsonb, null, 7)
) as v(nome, descricao, preco, unidade, opcoes, grupos, foto_url, ordem)
where c.nome = 'Aguardentes / Digestivos e Cognac';
