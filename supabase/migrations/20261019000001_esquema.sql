-- Sistema de pedidos por QR Code — Bom Paladar
-- Tabelas, regras de acesso (RLS) e funções chamadas pelo cliente com supabase.rpc.

-- ---------------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------------

-- Token secreto do QR Code: 12 caracteres sem letras/números ambíguos (0, o, 1, l, i).
create or replace function public.gerar_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + (get_byte(b, i) % 31), 1), '')
  from extensions.gen_random_bytes(12) as b, generate_series(0, 11) as i
$$;

-- Só é administrador quem tem app_metadata.role = 'admin' (definido à mão no Supabase).
-- Assim, mesmo que alguém consiga criar uma conta, não tem acesso ao painel.
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique check (numero > 0),
  nome text not null check (length(trim(nome)) between 1 and 40),
  qr_token text not null unique default public.gerar_token() check (length(qr_token) >= 10),
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.restaurant_tables (id) on delete cascade,
  aberta_em timestamptz not null default now(),
  fechada_em timestamptz,
  check (fechada_em is null or fechada_em >= aberta_em)
);

-- Só pode existir uma sessão aberta por mesa.
create unique index table_sessions_uma_aberta on public.table_sessions (table_id) where fechada_em is null;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 60),
  ordem int not null default 0
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  nome text not null check (length(trim(nome)) between 1 and 120),
  descricao text,
  preco numeric(10, 2) not null check (preco >= 0),
  -- Ex.: "p/ pessoa" nos buffets, "dose" nas bebidas espirituosas.
  unidade text,
  -- Produtos com o mesmo preço numa só linha (ex.: Super Bock / Castle Lite): o cliente escolhe um.
  opcoes text[] not null default '{}',
  -- Buffets: o que é servido, grupo a grupo: [{"grupo": "Carnes", "itens": ["..."]}].
  grupos jsonb,
  foto_url text,
  disponivel boolean not null default true,
  ordem int not null default 0
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.table_sessions (id) on delete restrict,
  table_id uuid not null references public.restaurant_tables (id) on delete restrict,
  estado text not null default 'recebido'
    check (estado in ('recebido', 'em_preparacao', 'entregue', 'cancelado')),
  nota_geral text check (length(nota_geral) <= 500),
  total numeric(12, 2) not null default 0 check (total >= 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  -- Nome, opção e preço copiados no momento do pedido: o histórico não muda se o cardápio mudar.
  nome text not null,
  opcao text,
  preco_unitario numeric(10, 2) not null check (preco_unitario >= 0),
  quantidade int not null check (quantidade between 1 and 99),
  nota text check (length(nota) <= 200)
);

create index menu_items_category on public.menu_items (category_id, ordem);
create index orders_table_criado on public.orders (table_id, criado_em desc);
create index orders_session on public.orders (session_id);
create index orders_criado on public.orders (criado_em desc);
create index order_items_order on public.order_items (order_id);
create index order_items_menu_item on public.order_items (menu_item_id);
create index table_sessions_table on public.table_sessions (table_id);

create trigger orders_atualizado_em
before update on public.orders
for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- Regras de acesso (RLS)
-- ---------------------------------------------------------------------------

alter table public.restaurant_tables enable row level security;
alter table public.table_sessions enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Cardápio público: qualquer pessoa lê categorias e pratos.
create policy "cardapio publico" on public.categories for select to anon, authenticated using (true);
create policy "pratos publicos" on public.menu_items for select to anon, authenticated using (true);

-- O administrador tem acesso total. O visitante anónimo não lê nem escreve mais nada:
-- tudo o que o cliente faz passa pelas funções abaixo.
create policy "admin categorias" on public.categories for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin pratos" on public.menu_items for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin mesas" on public.restaurant_tables for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin sessoes" on public.table_sessions for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin pedidos" on public.orders for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin itens" on public.order_items for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Tempo real no painel (respeita o RLS: só o admin recebe eventos).
alter publication supabase_realtime add table public.orders;

-- ---------------------------------------------------------------------------
-- Funções do cliente (SECURITY DEFINER, validam o qr_token)
-- ---------------------------------------------------------------------------

create or replace function public.get_table_info(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('numero', t.numero, 'nome', t.nome)
  from public.restaurant_tables t
  where t.qr_token = p_token and t.ativa
$$;

-- Pedidos da sessão aberta da mesa (o cliente nunca vê sessões anteriores nem outras mesas).
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
$$;

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
    raise exception 'QR Code inválido. Chame um empregado.' using errcode = 'P0001', hint = 'mesa_invalida';
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

    insert into public.order_items (order_id, menu_item_id, nome, opcao, preco_unitario, quantidade, nota)
    values (v_order_id, v_item.id, v_item.nome, v_opcao, v_item.preco, v_qtd, v_nota);

    v_total := v_total + v_item.preco * v_qtd;
  end loop;

  update public.orders set total = v_total where id = v_order_id;

  return jsonb_build_object('id', v_order_id, 'total', v_total, 'criado_em', v_criado_em);
end
$$;

-- ---------------------------------------------------------------------------
-- Permissões das funções
-- ---------------------------------------------------------------------------

revoke all on function public.gerar_token() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.tocar_atualizado_em() from public, anon, authenticated;
revoke all on function public.get_table_info(text) from public, anon, authenticated;
revoke all on function public.get_table_orders(text) from public, anon, authenticated;
revoke all on function public.create_order(text, jsonb, text) from public, anon, authenticated;

-- O admin precisa destas duas (token por omissão ao criar mesa e as regras de acesso).
grant execute on function public.gerar_token() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Funções do cliente: o anónimo, e também o admin com sessão iniciada no mesmo
-- telemóvel (senão o cardápio da mesa falharia para quem está logado).
grant execute on function public.get_table_info(text) to anon, authenticated;
grant execute on function public.get_table_orders(text) to anon, authenticated;
grant execute on function public.create_order(text, jsonb, text) to anon, authenticated;
