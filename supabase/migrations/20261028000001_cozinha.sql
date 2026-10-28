-- Ecrã da cozinha: os pedidos com comida aparecem também num ecrã na cozinha (tablet ou telemóvel),
-- aberto por um link próprio (/cozinha/<token>), sem conta nem palavra-passe.
-- A cozinha carrega "Começar" e "Pronto"; a recepção vê o estado e é avisada quando está pronto.

-- ---------------------------------------------------------------------------
-- O que vai para a cozinha
-- ---------------------------------------------------------------------------

alter table public.categories add column para_cozinha boolean not null default false;

update public.categories set para_cozinha = true
where nome in ('Menu Pasta', 'Lasanhas', 'Buffet', 'Sobremesas', 'Extras');

-- Copiado da categoria quando o pedido é feito: mudar a categoria depois não muda pedidos antigos.
alter table public.order_items add column para_cozinha boolean not null default false;

update public.order_items i
set para_cozinha = c.para_cozinha
from public.menu_items m
join public.categories c on c.id = m.category_id
where m.id = i.menu_item_id;

-- ---------------------------------------------------------------------------
-- Estado na cozinha
-- ---------------------------------------------------------------------------

-- cozinha_inicio_em: "Começar". cozinha_pronto_em: "Pronto" (ou "OK" num talão cancelado):
-- o talão sai do ecrã da cozinha.
-- Os pedidos de antes do ecrã da cozinha já foram tratados no papel: ficam como "prontos" ao criar a
-- coluna (o default preenche-os sem UPDATE, por isso a hora em que foram atendidos não muda) e não
-- aparecem na cozinha. Logo a seguir o default sai: os pedidos novos começam sem hora de pronto.
alter table public.orders
  add column cozinha_inicio_em timestamptz,
  add column cozinha_pronto_em timestamptz default now();

alter table public.orders alter column cozinha_pronto_em drop default;

-- ---------------------------------------------------------------------------
-- Link da cozinha
-- ---------------------------------------------------------------------------

create table public.cozinha_acesso (
  id int primary key default 1 check (id = 1),
  token text not null unique default public.gerar_token() check (length(token) >= 10),
  criado_em timestamptz not null default now()
);

insert into public.cozinha_acesso default values;

alter table public.cozinha_acesso enable row level security;

-- Só o administrador vê o link (no separador "Cozinha" do painel) e gera um novo.
create policy "admin cozinha" on public.cozinha_acesso for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Pedido do cliente: marca os itens da cozinha
-- ---------------------------------------------------------------------------

-- Cria um pedido numa só transação. A mesa vem do token; os preços vêm da base.
-- p_items: [{"menu_item_id": uuid, "quantidade": int, "nota": text?, "opcao": text?}]
create or replace function public.create_order(p_token text, p_items jsonb, p_nota text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_table public.restaurant_tables%rowtype;
  v_session_id uuid;
  v_order_id uuid;
  v_total numeric(12, 2) := 0;
  v_recentes int;
  v_el jsonb;
  v_item public.menu_items%rowtype;
  v_item_id uuid;
  v_qtd int;
  v_nota text;
  v_opcao text;
  v_nota_geral text := nullif(trim(p_nota), '');
  v_criado_em timestamptz;
begin
  -- Bloqueia a linha da mesa: pedidos simultâneos da mesma mesa ficam em fila
  -- (uma só sessão aberta, limite de pedidos por minuto fiável).
  select * into v_table
  from public.restaurant_tables
  where qr_token = p_token and ativa
  for update;

  if not found then
    raise exception 'QR Code inválido. Chame um atendente.' using errcode = 'P0001', hint = 'mesa_invalida';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'O pedido está vazio.' using errcode = 'P0001', hint = 'pedido_vazio';
  end if;

  if jsonb_array_length(p_items) > 50 then
    raise exception 'O pedido tem demasiados itens.' using errcode = 'P0001', hint = 'pedido_grande';
  end if;

  if length(v_nota_geral) > 500 then
    raise exception 'A nota do pedido é demasiado longa (máximo 500 caracteres).' using errcode = 'P0001', hint = 'nota_longa';
  end if;

  select count(*) into v_recentes
  from public.orders
  where table_id = v_table.id and criado_em > now() - interval '1 minute';

  if v_recentes >= 5 then
    raise exception 'Muitos pedidos seguidos. Espere um minuto e tente de novo.' using errcode = 'P0001', hint = 'limite';
  end if;

  select id into v_session_id
  from public.table_sessions
  where table_id = v_table.id and fechada_em is null;

  if v_session_id is null then
    insert into public.table_sessions (table_id) values (v_table.id) returning id into v_session_id;
  end if;

  insert into public.orders (session_id, table_id, nota_geral)
  values (v_session_id, v_table.id, v_nota_geral)
  returning id, criado_em into v_order_id, v_criado_em;

  for v_el in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_item_id := (v_el ->> 'menu_item_id')::uuid;
      v_qtd := (v_el ->> 'quantidade')::int;
    exception when others then
      raise exception 'Item do pedido inválido.' using errcode = 'P0001', hint = 'item_invalido';
    end;

    if v_item_id is null or v_qtd is null or v_qtd < 1 or v_qtd > 99 then
      raise exception 'Quantidade inválida (de 1 a 99).' using errcode = 'P0001', hint = 'quantidade';
    end if;

    select * into v_item from public.menu_items where id = v_item_id;
    if not found then
      raise exception 'Um dos pratos já não existe no cardápio.' using errcode = 'P0001', hint = 'prato_inexistente';
    end if;
    if not v_item.disponivel then
      raise exception '"%" está esgotado.', v_item.nome using errcode = 'P0001', hint = 'esgotado';
    end if;

    v_nota := nullif(trim(v_el ->> 'nota'), '');
    if length(v_nota) > 200 then
      raise exception 'A nota de "%" é demasiado longa (máximo 200 caracteres).', v_item.nome using errcode = 'P0001', hint = 'nota_longa';
    end if;

    v_opcao := nullif(trim(v_el ->> 'opcao'), '');
    if cardinality(v_item.opcoes) > 0 then
      if v_opcao is null or not (v_opcao = any (v_item.opcoes)) then
        raise exception 'Escolha uma opção para "%".', v_item.nome using errcode = 'P0001', hint = 'opcao';
      end if;
    else
      v_opcao := null;
    end if;

    -- O item vai para o ecrã da cozinha se a categoria dele for da cozinha (copiado agora: o histórico não muda).
    insert into public.order_items (order_id, menu_item_id, nome, opcao, preco_unitario, quantidade, nota, para_cozinha)
    values (
      v_order_id, v_item.id, v_item.nome, v_opcao, v_item.preco, v_qtd, v_nota,
      coalesce((select c.para_cozinha from public.categories c where c.id = v_item.category_id), false)
    );

    v_total := v_total + v_item.preco * v_qtd;
  end loop;

  update public.orders set total = v_total where id = v_order_id;

  return jsonb_build_object('id', v_order_id, 'total', v_total, 'criado_em', v_criado_em);
end
$$;

-- ---------------------------------------------------------------------------
-- Funções do ecrã da cozinha (SECURITY DEFINER, validam o token da cozinha)
-- ---------------------------------------------------------------------------

-- Talões da cozinha: pedidos das últimas 12 horas com comida e ainda não prontos, do mais antigo
-- para o mais recente, só com os itens da cozinha. Os cancelados aparecem até a cozinha carregar "OK".
create or replace function public.get_kitchen_orders(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_token is null or not exists (select 1 from public.cozinha_acesso where token = p_token) then
    raise exception 'Link da cozinha inválido.' using errcode = 'P0001', hint = 'cozinha_invalida';
  end if;

  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'mesa', t.nome,
        'estado', o.estado,
        'nota_geral', o.nota_geral,
        'criado_em', o.criado_em,
        'cozinha_inicio_em', o.cozinha_inicio_em,
        'itens', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'nome', i.nome, 'opcao', i.opcao, 'quantidade', i.quantidade, 'nota', i.nota
          ) order by i.nome), '[]'::jsonb)
          from public.order_items i
          where i.order_id = o.id and i.para_cozinha
        )
      ) order by o.criado_em
    ), '[]'::jsonb)
    from public.orders o
    join public.restaurant_tables t on t.id = o.table_id
    where o.cozinha_pronto_em is null
      and o.criado_em > now() - interval '12 hours'
      and exists (select 1 from public.order_items i where i.order_id = o.id and i.para_cozinha)
  );
end
$$;

-- p_acao: 'comecar' (talão "A preparar"; o cliente vê "Em preparação"), 'pronto' (sai do ecrã;
-- a recepção é avisada) ou 'ok' (tira um talão cancelado). Repetir uma ação não faz mal.
create or replace function public.set_kitchen_state(p_token text, p_order_id uuid, p_acao text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_token is null or not exists (select 1 from public.cozinha_acesso where token = p_token) then
    raise exception 'Link da cozinha inválido.' using errcode = 'P0001', hint = 'cozinha_invalida';
  end if;

  if p_acao = 'comecar' then
    update public.orders
    set cozinha_inicio_em = coalesce(cozinha_inicio_em, now()),
        estado = case when estado = 'recebido' then 'em_preparacao' else estado end
    where id = p_order_id and estado <> 'cancelado' and cozinha_pronto_em is null;
  elsif p_acao = 'pronto' then
    update public.orders
    set cozinha_inicio_em = coalesce(cozinha_inicio_em, now()),
        cozinha_pronto_em = now()
    where id = p_order_id and estado <> 'cancelado' and cozinha_pronto_em is null;
  elsif p_acao = 'ok' then
    update public.orders
    set cozinha_pronto_em = now()
    where id = p_order_id and estado = 'cancelado' and cozinha_pronto_em is null;
  else
    raise exception 'Ação da cozinha inválida.' using errcode = 'P0001', hint = 'acao_invalida';
  end if;
end
$$;

revoke all on function public.get_kitchen_orders(text) from public, anon, authenticated;
revoke all on function public.set_kitchen_state(text, uuid, text) from public, anon, authenticated;
grant execute on function public.get_kitchen_orders(text) to anon, authenticated;
grant execute on function public.set_kitchen_state(text, uuid, text) to anon, authenticated;
