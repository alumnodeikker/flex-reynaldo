'use client'

import { CheckCircle, Clock, ChefHat, Package } from 'lucide-react'

const ESTADOS = {
  pendiente: { label: 'Pendiente',  color: 'text-amber-400',   bg: 'bg-amber-500/20',   border: 'border-amber-500/30',   icon: Clock       },
  en_barra:  { label: 'Preparando', color: 'text-blue-400',    bg: 'bg-blue-500/20',    border: 'border-blue-500/30',    icon: ChefHat     },
  listo:     { label: 'Listo',      color: 'text-purple-400',  bg: 'bg-purple-500/20',  border: 'border-purple-500/30',  icon: Package     },
  entregado: { label: 'Entregado',  color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-zinc-800',       icon: CheckCircle },
}

const BOTONES = {
  pendiente: { label: 'Preparar', clases: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-blue-500/30' },
  en_barra:  { label: 'Listo',    clases: 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border-purple-500/30' },
  listo:     { label: 'Entregar', clases: 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30' },
}

function formatHora(iso) {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export default function PedidoCard({ pedido, onAvanzar }) {
  const estado = ESTADOS[pedido.estado] ?? ESTADOS.pendiente
  const IconEstado = estado.icon
  const boton = BOTONES[pedido.estado]

  const cliente = pedido.perfiles?.nombre ?? '—'
  const mesa    = pedido.mesas ? `Mesa ${pedido.mesas.numero}` : '—'
  const items   = pedido.pedido_items ?? []

  return (
    <div className={`bg-zinc-900 border ${estado.border} rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4`}>
      <div className={`shrink-0 ${estado.color}`}>
        <IconEstado size={24} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-zinc-100 font-semibold">{mesa}</span>
          <span className="text-zinc-500 text-sm">·</span>
          <span className="text-zinc-400 text-sm">{cliente}</span>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${estado.bg} ${estado.color}`}>
            {estado.label}
          </span>
        </div>
        <p className="text-zinc-500 text-sm">
          {items.map(i => `${i.cantidad}× ${i.productos?.nombre}`).join(' · ')}
        </p>
        <p className="text-zinc-600 text-xs mt-1">{formatHora(pedido.creado_en)}</p>
      </div>

      {boton && (
        <button
          onClick={() => onAvanzar(pedido.id, pedido.estado)}
          className={`shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${boton.clases}`}
        >
          {pedido.estado === 'pendiente' && <ChefHat size={15} />}
          {pedido.estado === 'en_barra'  && <Package size={15} />}
          {pedido.estado === 'listo'     && <CheckCircle size={15} />}
          {boton.label}
        </button>
      )}
      {pedido.estado === 'entregado' && (
        <span className="shrink-0 text-xs text-emerald-600 font-medium">Entregado</span>
      )}
    </div>
  )
}
