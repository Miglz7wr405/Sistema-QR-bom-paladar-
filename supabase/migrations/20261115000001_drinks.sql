-- Cartões novos do bar (novembro 2026): Menu Cocktail com preços novos e categoria nova "Drinks com Gin" (gin duplo).
do $$
declare
  cock uuid := (select id from public.categories where nome = 'Cocktails');
  gin uuid;
begin
  update public.menu_items m set preco = v.preco, descricao = v.descricao, opcoes = v.opcoes, ordem = v.ordem, disponivel = true
  from (values
    ('Margarita', 300, 'Tequila branca, Triplesec, Lime e Sumo de Lima', '{}'::text[], 1),
    ('Bom Paladar Intense Girl', 350, 'Licor de Morango, Pina Colada, Rum e Sumo de Ananás', '{}', 2),
    ('Caipirinha', 300, 'De Maracujá, Limão ou Frutos Vermelhos', '{Maracujá,Limão,"Frutos Vermelhos"}', 3),
    ('Caipirosca', 300, 'Vodka, Lima, Maracujá, Frutos Vermelhos, Kiwi, Tangerina e Xarope de Açúcar', '{}', 4),
    ('Mojito', 300, 'Rum Branco, Lima, Hortelã, Sprite ou Água Tónica', '{}', 5),
    ('Tequila Sunrise', 350, 'Tequila Branca, Sumo de Laranja e Grenadine', '{}', 6),
    ('Gin Tónico à Bom Paladar', 400, null, '{}', 7),
    ('Sexy on the Beach', 350, 'Vodka, Licor de Pêssego e Sumo de Laranja', '{}', 8),
    ('Blue Lagoon', 350, 'Vodka, Licor Blue Curaçao, Sumo de Limão e Sprite', '{}', 9),
    ('Piña Colada', 400, 'Rum Branco, Base Piña Colada e Sumo de Ananás', '{}', 11),
    ('Sangria', 600, 'Aguardente de Cana, Triplesec, Xarope de Menta, Brandy, Vinho e Sprite', '{"Vinho Branco","Vinho Tinto"}', 13)
  ) as v(nome, preco, descricao, opcoes, ordem)
  where m.category_id = cock and m.nome = v.nome;

  update public.menu_items set disponivel = false
  where category_id = cock and nome in ('Blue Hawaii', 'Caipirinha de Cerveja à Bom Paladar');

  insert into public.menu_items (category_id, nome, preco, ordem)
  values (cock, 'Strawberry Daiquiri', 400, 10), (cock, 'Pornstar Martini', 400, 12);

  update public.categories set ordem = ordem + 1 where ordem > (select ordem from public.categories where id = cock);
  insert into public.categories (nome, ordem, para_cozinha)
  values ('Drinks com Gin', (select ordem from public.categories where id = cock) + 1, false)
  returning id into gin;

  insert into public.menu_items (category_id, nome, descricao, preco, unidade, ordem) values
    (gin, 'Pink Sunset', 'Gin Pink, Tónica, Morangos e Limão', 500, 'gin duplo', 1),
    (gin, 'Gin Fizz', 'Gin Beefeater, Limão, Xarope e Água com Gás', 450, 'gin duplo', 2),
    (gin, 'Elderflower', 'Gin Hendrick''s, Tónica, Licor St. Germain e Pepino', 450, 'gin duplo', 3),
    (gin, 'Mediterrâneo', 'Gin Beefeater, Tónica, Alecrim e Toranja', 450, 'gin duplo', 4),
    (gin, 'Red Berries', 'Gin Tanqueray, Tónica, Frutas Vermelhas e Limão', 500, 'gin duplo', 5),
    (gin, 'Citrus', 'Gin Tanqueray, Tónica, Limão e Laranja', 500, 'gin duplo', 6),
    (gin, 'Tropical', 'Gin Bombay, Tónica, Polpa de Maracujá e Hortelã', 500, 'gin duplo', 7),
    (gin, 'Basil Smash', 'Gin Gordon''s, Sumo de Limão, Xarope, Folhas de Manjericão e Gelo', 400, 'gin duplo', 8);
end $$;
