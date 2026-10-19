import { supabase } from './supabase'
import type { Categoria, MesaInfo, PedidoCliente, Prato } from './types'

export async function obterCardapio(): Promise<{ categorias: Categoria[]; pratos: Prato[] }> {
  const [cats, pratos] = await Promise.all([
    supabase.from('categories').select('id, nome, ordem').order('ordem'),
    supabase
      .from('menu_items')
      .select('id, category_id, nome, descricao, preco, unidade, opcoes, grupos, foto_url, disponivel, ordem')
      .order('ordem'),
  ])
  if (cats.error) throw cats.error
  if (pratos.error) throw pratos.error
  return {
    categorias: cats.data,
    pratos: (pratos.data as Prato[]).map((p) => ({ ...p, preco: Number(p.preco) })),
  }
}

export async function obterMesa(token: string): Promise<MesaInfo | null> {
  const { data, error } = await supabase.rpc('get_table_info', { p_token: token })
  if (error) throw error
  return (data as MesaInfo | null) ?? null
}

export async function obterPedidosDaMesa(token: string): Promise<PedidoCliente[]> {
  const { data, error } = await supabase.rpc('get_table_orders', { p_token: token })
  if (error) throw error
  return ((data as PedidoCliente[] | null) ?? []).map((p) => ({
    ...p,
    total: Number(p.total),
    itens: p.itens.map((i) => ({ ...i, preco_unitario: Number(i.preco_unitario) })),
  }))
}

export interface ItemParaEnviar {
  menu_item_id: string
  quantidade: number
  nota: string | null
  opcao: string | null
}

export async function enviarPedido(token: string, itens: ItemParaEnviar[], nota: string | null) {
  const { data, error } = await supabase.rpc('create_order', { p_token: token, p_items: itens, p_nota: nota })
  if (error) throw error
  return data as { id: string; total: number; criado_em: string }
}
