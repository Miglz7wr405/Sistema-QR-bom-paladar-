export type EstadoPedido = 'recebido' | 'em_preparacao' | 'entregue' | 'cancelado'

export interface Categoria {
  id: string
  nome: string
  ordem: number
  /** Os pedidos desta categoria aparecem no ecrã da cozinha (só vem no painel). */
  para_cozinha?: boolean
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
  /** Vai para o ecrã da cozinha (copiado da categoria quando o pedido foi feito). */
  para_cozinha?: boolean
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
  /** A cozinha carregou "Começar". */
  cozinha_inicio_em?: string | null
  /** A cozinha carregou "Pronto" (ou "OK" num talão cancelado). */
  cozinha_pronto_em?: string | null
  order_items?: ItemPedido[]
}

/** Um pedido como o ecrã da cozinha o vê: só os itens da cozinha. */
export interface TalaoCozinha {
  id: string
  mesa: string
  estado: EstadoPedido
  nota_geral: string | null
  criado_em: string
  cozinha_inicio_em: string | null
  itens: { nome: string; opcao: string | null; quantidade: number; nota: string | null }[]
}

export type AcaoCozinha = 'comecar' | 'pronto' | 'ok'
