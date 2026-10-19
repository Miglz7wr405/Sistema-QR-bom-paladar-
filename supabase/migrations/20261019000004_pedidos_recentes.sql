-- "Os meus pedidos" do cliente mostra só os pedidos dos últimos 20 minutos, para a lista não crescer
-- e o cliente seguinte da mesma mesa não ver pedidos antigos. Os pedidos continuam guardados (histórico).

create or replace function public.get_table_orders(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'estado', o.estado,
      'nota_geral', o.nota_geral,
      'total', o.total,
      'criado_em', o.criado_em,
      'itens', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'nome', i.nome, 'opcao', i.opcao, 'quantidade', i.quantidade,
          'preco_unitario', i.preco_unitario, 'nota', i.nota
        ) order by i.nome), '[]'::jsonb)
        from public.order_items i
        where i.order_id = o.id
      )
    ) order by o.criado_em desc
  ), '[]'::jsonb)
  from public.restaurant_tables t
  join public.table_sessions s on s.table_id = t.id and s.fechada_em is null
  join public.orders o on o.session_id = s.id
  where t.qr_token = p_token and t.ativa
    and o.criado_em > now() - interval '20 minutes'
$$;
