-- Menu principal (folha impressa): entradas, peixes e mariscos, carnes, sopas, petiscos, arroz e saladas, encomendas.
-- Vão para a cozinha. Ficam a seguir ao Buffet; as categorias seguintes descem 9 posições.
do $$
declare
  base int := (select ordem from public.categories where nome = 'Buffet');
  cat uuid;
  n int := 0;
  sec record;
begin
  update public.categories set ordem = ordem + 9 where ordem > base;
  for sec in select * from (values
    ('Entradas', '[["Pão de alho recheado c/ queijo",350,null],["Camarão alhinho (7 unidades)",400,null],["Trinchado de carne de vaca (nacional)",400,null],["Asinhas crocantes",400,null],["Salgados (3 unidades)",250,"Rissóis, chamuças, pastéis, coxinhas e croquetes"]]'::jsonb),
    ('Sanduíches e Omeletes', '[["Prego no pão simples (carne nacional)",200,null],["Prego no pão à Bom Paladar (250g)",500,null],["Omelete simples",250,null],["Omelete mista",400,null],["Tosta de atum",250,null]]'),
    ('Mariscos e Peixes', '[["Peixe inteiro pequeno",950,"Garoupa, Vermelhão, Madje ou Pedra (indique na nota)"],["Posta de peixe grelhado",950,"Garoupa, Serra, Cherewa, Vermelhão, Atum ou Pedra (indique na nota)"],["Peixe inteiro normal",1200,"Garoupa, Vermelhão, Pende, Madje ou Pedra (indique na nota)"],["Peixe inteiro médio",1500,"Garoupa, Vermelhão, Madje ou Pedra (indique na nota)"],["Peixe inteiro grande",2400,"Garoupa, Vermelhão, Corvina Real ou Pedra (indique na nota)"],["Camarão TG (3 unid.)",2100,"Grelhado ou na frigideira (indique na nota)"],["Camarão médio (5 unid.)",1600,"Grelhado ou na frigideira (indique na nota)"],["Camarão K na frigideira (7 unid.)",1200,null],["Lula grelhada",1200,null]]'),
    ('Combos / Aparelhada de Mariscos', '[["Aparelhada para 2 pessoas",3000,"Lula, camarão e lagosta"],["Aparelhada à Bay Juma",4000,"Lula, camarão, caranguejo, lagosta, amêijoa e postinha de peixe"]]'),
    ('Aves e Carnes', '[["Frango à mamãe",1300,"Batata, salada, ovos e salsichas"],["Galinha cafrial",1200,null],["Frango inteiro (caril)",1200,null],["½ Galinha cafrial ou frango na grelha",600,null],["Galinha cafrial inteira à zambeziana",1100,null],["Bife à Bom Paladar (carne importada)",1200,null],["Bife à malandro",1200,null],["Picanha fatiada à brasileira",1400,null],["T-Bone grelhado",1300,null],["Alcatra na brasa",1200,null],["Lombo",1200,null]]'),
    ('Sopas', '[["Sopa de abóbora com camarão",200,null],["Sopa de legumes",200,null],["Sopa de feijão (ervilha)",200,null]]'),
    ('Petiscos', '[["Dobrada",300,null],["Cabeça de peixe",300,null],["Cabeça de vaca",300,null],["Mão de vaca",300,null],["Carne de vaca (água e sal e limão)",300,null]]'),
    ('Arroz à Moda do Chefe e Saladas', '[["Arroz de marisco",1200,null],["Arroz de garoupa",1000,null],["Arroz grego",1000,null],["Arroz de feijão",850,null],["Salada mista (refeição)",350,null],["Salada de frango (refeição)",750,null],["Salada de atum (refeição)",450,null],["Salada grega (refeição)",500,null]]'),
    ('Pedidos por Encomenda', '[["Caranguejo recheado (2 unidades)",500,null],["Caranguejo grelhado (3 unidades)",600,null],["Lagosta grelhada (4 unid.)",1800,null],["Bacalhau à Gomes de Sá",1400,null],["Bacalhau à Brás",1400,null],["Bacalhau à Lagareiro",1500,null],["Bacalhau à Braga",1500,null],["Pato no forno c/ laranja",1850,null],["Perna de cabrito no forno",1500,null],["Puré de abóbora",200,null],["Mucapata",300,null]]')
  ) as s(nome, itens) loop
    n := n + 1;
    insert into public.categories (nome, ordem, para_cozinha) values (sec.nome, base + n, true) returning id into cat;
    insert into public.menu_items (category_id, nome, preco, descricao, ordem)
    select cat, i->>0, (i->>1)::numeric, i->>2, o::int from jsonb_array_elements(sec.itens) with ordinality as t(i, o);
  end loop;
end $$;
