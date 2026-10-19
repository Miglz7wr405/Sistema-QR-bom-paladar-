-- Testes da lógica crítica da base de dados.
-- Corre tudo dentro de um bloco que acaba SEMPRE com um erro, para que nada fique gravado:
--   * "TESTES OK: N verificações" = todos passaram;
--   * qualquer outra mensagem = falhou (diz qual).
-- Correr no SQL Editor do Supabase (ou com psql) depois das migrações.

do $$
declare
  t1 text;
  t2 text;
  item_a uuid;          -- prato normal
  item_b uuid;          -- prato com opções
  preco_a numeric;
  r jsonb;
  pedidos jsonb;
  n int := 0;
  msg text;
  dica text;
begin
  select qr_token into t1 from public.restaurant_tables where numero = 1;
  select qr_token into t2 from public.restaurant_tables where numero = 2;
  select id, preco into item_a, preco_a from public.menu_items where cardinality(opcoes) = 0 and disponivel order by preco desc limit 1;
  select id into item_b from public.menu_items where cardinality(opcoes) > 0 limit 1;

  -- Começa de uma mesa limpa (dentro do bloco, é desfeito no fim).
  update public.table_sessions set fechada_em = now() where fechada_em is null;
  delete from public.orders where criado_em > now() - interval '1 minute';

  -- 1. Token inválido é rejeitado.
  begin
    perform public.create_order('token-que-nao-existe', jsonb_build_array(jsonb_build_object('menu_item_id', item_a, 'quantidade', 1)), null);
    raise exception 'FALHOU 1: token inválido aceite';
  exception when others then
    get stacked diagnostics msg = message_text, dica = pg_exception_hint;
    if dica is distinct from 'mesa_invalida' then raise exception 'FALHOU 1: %', msg; end if;
  end;
  n := n + 1;

  -- 2. Mesa inativa é rejeitada.
  update public.restaurant_tables set ativa = false where numero = 2;
  begin
    perform public.create_order(t2, jsonb_build_array(jsonb_build_object('menu_item_id', item_a, 'quantidade', 1)), null);
    raise exception 'FALHOU 2: mesa inativa aceite';
  exception when others then
    get stacked diagnostics msg = message_text, dica = pg_exception_hint;
    if dica is distinct from 'mesa_invalida' then raise exception 'FALHOU 2: %', msg; end if;
  end;
  update public.restaurant_tables set ativa = true where numero = 2;
  n := n + 1;

  -- 3. Preço adulterado pelo cliente é ignorado: conta o preço da base.
  r := public.create_order(t1, jsonb_build_array(
    jsonb_build_object('menu_item_id', item_a, 'quantidade', 2, 'preco', 1, 'preco_unitario', 1, 'nota', '  sem cebola ')
  ), 'nota geral');
  if (r ->> 'total')::numeric <> preco_a * 2 then
    raise exception 'FALHOU 3: total % em vez de %', r ->> 'total', preco_a * 2;
  end if;
  if (select preco_unitario from public.order_items where order_id = (r ->> 'id')::uuid) <> preco_a then
    raise exception 'FALHOU 3: preço unitário gravado errado';
  end if;
  if (select nota from public.order_items where order_id = (r ->> 'id')::uuid) <> 'sem cebola' then
    raise exception 'FALHOU 3: nota do item não foi limpa';
  end if;
  n := n + 1;

  -- 4. O pedido fica na mesa do token, numa sessão aberta.
  if (select t.numero from public.orders o join public.restaurant_tables t on t.id = o.table_id where o.id = (r ->> 'id')::uuid) <> 1 then
    raise exception 'FALHOU 4: pedido gravado noutra mesa';
  end if;
  if (select s.fechada_em from public.orders o join public.table_sessions s on s.id = o.session_id where o.id = (r ->> 'id')::uuid) is not null then
    raise exception 'FALHOU 4: sessão não está aberta';
  end if;
  n := n + 1;

  -- 5. Prato esgotado é rejeitado.
  update public.menu_items set disponivel = false where id = item_a;
  begin
    perform public.create_order(t1, jsonb_build_array(jsonb_build_object('menu_item_id', item_a, 'quantidade', 1)), null);
    raise exception 'FALHOU 5: prato esgotado aceite';
  exception when others then
    get stacked diagnostics msg = message_text, dica = pg_exception_hint;
    if dica is distinct from 'esgotado' then raise exception 'FALHOU 5: %', msg; end if;
  end;
  update public.menu_items set disponivel = true where id = item_a;
  n := n + 1;

  -- 6. Quantidade inválida, pedido vazio e prato inexistente são rejeitados.
  begin
    perform public.create_order(t1, jsonb_build_array(jsonb_build_object('menu_item_id', item_a, 'quantidade', 0)), null);
    raise exception 'FALHOU 6a: quantidade 0 aceite';
  exception when others then
    get stacked diagnostics msg = message_text, dica = pg_exception_hint;
    if dica is distinct from 'quantidade' then raise exception 'FALHOU 6a: %', msg; end if;
  end;
  begin
    perform public.create_order(t1, '[]'::jsonb, null);
    raise exception 'FALHOU 6b: pedido vazio aceite';
  exception when others then
    get stacked diagnostics msg = message_text, dica = pg_exception_hint;
    if dica is distinct from 'pedido_vazio' then raise exception 'FALHOU 6b: %', msg; end if;
  end;
  begin
    perform public.create_order(t1, jsonb_build_array(jsonb_build_object('menu_item_id', gen_random_uuid(), 'quantidade', 1)), null);
    raise exception 'FALHOU 6c: prato inexistente aceite';
  exception when others then
    get stacked diagnostics msg = message_text, dica = pg_exception_hint;
    if dica is distinct from 'prato_inexistente' then raise exception 'FALHOU 6c: %', msg; end if;
  end;
  n := n + 1;

  -- 7. Prato com opções exige uma opção válida.
  begin
    perform public.create_order(t1, jsonb_build_array(jsonb_build_object('menu_item_id', item_b, 'quantidade', 1, 'opcao', 'Inventada')), null);
    raise exception 'FALHOU 7: opção inválida aceite';
  exception when others then
    get stacked diagnostics msg = message_text, dica = pg_exception_hint;
    if dica is distinct from 'opcao' then raise exception 'FALHOU 7: %', msg; end if;
  end;
  r := public.create_order(t1, jsonb_build_array(jsonb_build_object(
    'menu_item_id', item_b, 'quantidade', 1,
    'opcao', (select opcoes[1] from public.menu_items where id = item_b))), null);
  n := n + 1;

  -- 8. Isolamento: a mesa 2 não vê os pedidos da mesa 1, e a mesa 1 vê os seus 2.
  pedidos := public.get_table_orders(t2);
  if jsonb_array_length(pedidos) <> 0 then raise exception 'FALHOU 8: mesa 2 vê % pedidos', jsonb_array_length(pedidos); end if;
  pedidos := public.get_table_orders(t1);
  if jsonb_array_length(pedidos) <> 2 then raise exception 'FALHOU 8: mesa 1 vê % pedidos', jsonb_array_length(pedidos); end if;
  perform public.create_order(t2, jsonb_build_array(jsonb_build_object('menu_item_id', item_a, 'quantidade', 1)), null);
  if jsonb_array_length(public.get_table_orders(t2)) <> 1 or jsonb_array_length(public.get_table_orders(t1)) <> 2 then
    raise exception 'FALHOU 8: pedido da mesa 2 apareceu na mesa 1';
  end if;
  n := n + 1;

  -- 9. Depois de fechar a mesa, o mesmo QR abre uma sessão nova e vazia.
  update public.table_sessions set fechada_em = now()
  where fechada_em is null and table_id = (select id from public.restaurant_tables where numero = 1);
  if jsonb_array_length(public.get_table_orders(t1)) <> 0 then raise exception 'FALHOU 9: sessão fechada ainda visível'; end if;
  r := public.create_order(t1, jsonb_build_array(jsonb_build_object('menu_item_id', item_a, 'quantidade', 1)), null);
  if jsonb_array_length(public.get_table_orders(t1)) <> 1 then raise exception 'FALHOU 9: nova sessão não tem o pedido novo'; end if;
  if (select count(*) from public.table_sessions where fechada_em is null and table_id = (select id from public.restaurant_tables where numero = 1)) <> 1 then
    raise exception 'FALHOU 9: mais de uma sessão aberta';
  end if;
  n := n + 1;

  -- 10. Limite: no máximo 5 pedidos por mesa por minuto (a mesa 1 já tem 3 neste minuto).
  perform public.create_order(t1, jsonb_build_array(jsonb_build_object('menu_item_id', item_a, 'quantidade', 1)), null);
  perform public.create_order(t1, jsonb_build_array(jsonb_build_object('menu_item_id', item_a, 'quantidade', 1)), null);
  begin
    perform public.create_order(t1, jsonb_build_array(jsonb_build_object('menu_item_id', item_a, 'quantidade', 1)), null);
    raise exception 'FALHOU 10: sexto pedido no mesmo minuto aceite';
  exception when others then
    get stacked diagnostics msg = message_text, dica = pg_exception_hint;
    if dica is distinct from 'limite' then raise exception 'FALHOU 10: %', msg; end if;
  end;
  n := n + 1;

  -- 11. O visitante anónimo não lê pedidos nem mesas, mas lê o cardápio.
  perform set_config('role', 'anon', true);
  if (select count(*) from public.orders) <> 0 then raise exception 'FALHOU 11: anónimo lê pedidos'; end if;
  if (select count(*) from public.restaurant_tables) <> 0 then raise exception 'FALHOU 11: anónimo lê mesas (e os tokens)'; end if;
  if (select count(*) from public.menu_items) = 0 then raise exception 'FALHOU 11: anónimo não lê o cardápio'; end if;
  begin
    update public.menu_items set preco = 1;
    if found then raise exception 'FALHOU 11: anónimo alterou preços'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.orders (session_id, table_id) values (gen_random_uuid(), gen_random_uuid());
    raise exception 'FALHOU 11: anónimo inseriu pedido diretamente';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'postgres', true);
  n := n + 1;

  raise exception 'TESTES OK: % verificações', n;
end
$$;
