import { ESTADOS } from '../../lib/format'
import type { EstadoPedido } from '../../lib/types'

export function EstadoBadge({ estado }: { estado: EstadoPedido }) {
  const e = ESTADOS[estado]
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.classe}`}>{e.rotulo}</span>
}
