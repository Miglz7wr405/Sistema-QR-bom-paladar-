export type EstadoPedido = 'recebido' | 'em_preparacao' | 'entregue' | 'cancelado'

export interface Categoria {
  id: string
  nome: string
  ordem: number
}

export interface GrupoBuffet {
  grupo: string
  itens: string[]
}

export interface Prato {
  id: string
  category_id: string
  nome: string
  descricao: string | null
  preco: number
  unidade: string | null
  opcoes: string[]
  grupos: GrupoBuffet[] | null
  foto_url: string | null
  disponivel: boolean
  ordem: number
}

export interface MesaInfo {
  numero: number
  nome: string
}

export interface ItemPedidoCliente {
  nome: string
  opcao: string | null
  quantidade: number
  preco_unitario: number
  nota: string | null
}

export interface PedidoCliente {
  id: string
  estado: EstadoPedido
  nota_geral: string | null
  total: number
  criado_em: string
  itens: ItemPedidoCliente[]
}

// Tabelas vistas pelo administrador.
export interface Mesa {
  id: string
  numero: number
  nome: string
  qr_token: string
  ativa: boolean
  criado_em: string
}

export interface Sessao {
  id: string
  table_id: string
  aberta_em: string
  fechada_em: string | null
}

export interface ItemPedido {
  id: string
  order_id: string
  menu_item_id: string | null
  nome: string
  opcao: string | null
  preco_unitario: number
  quantidade: number
  nota: string | null
}

export interface Pedido {
  id: string
  session_id: string
  table_id: string
  estado: EstadoPedido
  nota_geral: string | null
  total: number
  criado_em: string
  atualizado_em: string
  order_items?: ItemPedido[]
}
