'use client'

import { useState } from 'react'
import { MapPin, ShoppingBag } from 'lucide-react'

const TABS = [
  { id: 'pedidos', label: 'Pedidos', icon: ShoppingBag },
  { id: 'zonas', label: 'Mis zonas', icon: MapPin },
]

const ESTADO_PEDIDO = {
  entregado: { label: 'Entregado', cls: 'bg-emerald-500/20 text-emerald-400' },
  listo: { label: 'Listo', cls: 'bg-emerald-500/20 text-emerald-400' },
  en_barra: { label: 'En camino', cls: 'bg-amber-500/20 text-amber-400' },
  pendiente: { label: 'Pendiente', cls: 'bg-amber-500/20 text-amber-400' },
  cancelado: { label: 'Cancelado', cls: 'bg-zinc-700 text-zinc-500' },
}

const ESTADO_RESERVA = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-500/20 text-amber-400' },
  pagada: { label: 'Confirmada', cls: 'bg-emerald-500/20 text-emerald-400' },
  completada: { label: 'Completada', cls: 'bg-zinc-700 text-zinc-400' },
  cancelada: { label: 'Cancelada', cls: 'bg-zinc-700 text-zinc-500' },
}

function formatFecha(iso) {
  return new Date(iso).toLocaleString('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function MiAreaClient({ perfil, pedidos, reservas }) {
  const [tab, setTab] = useState('pedidos')

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">Mi área</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {perfil?.nombre ?? '—'} · <span className="capitalize">{perfil?.rol ?? ''}</span>
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === t.id ? 'bg-gold-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
            >
              <Icon size={15} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Mis zonas */}
      {tab === 'zonas' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          {reservas.length === 0 && (
            <p className="text-zinc-500 text-sm">No tienes reservas.</p>
          )}
          {reservas.map(r => {
            const estado = ESTADO_RESERVA[r.estado] ?? { label: r.estado, cls: 'bg-zinc-700 text-zinc-400' }
            return (
              <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-start gap-3 mb-3">
                  <MapPin size={18} className="text-gold-400 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-semibold text-zinc-100">{r.salas_vip?.nombre}</h3>
                    <p className="text-zinc-500 text-sm">{r.salas_vip?.descripcion}</p>
                  </div>
                </div>
                <div className="border-t border-zinc-800 pt-3 flex items-center justify-between text-xs text-zinc-500">
                  <span>{formatFecha(r.inicio)} – {formatFecha(r.fin)}</span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${estado.cls}`}>{estado.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pedidos */}
      {tab === 'pedidos' && (
        <div className="space-y-4 max-w-2xl">
          {pedidos.length === 0 && (
            <p className="text-zinc-500 text-sm">No tienes pedidos.</p>
          )}
          {pedidos.map(p => {
            const total = p.total ?? p.pedido_items.reduce((s, i) => s + i.precio_unit * i.cantidad, 0)
            const estado = ESTADO_PEDIDO[p.estado] ?? { label: p.estado, cls: 'bg-zinc-700 text-zinc-400' }
            return (
              <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-zinc-100 font-medium text-sm">
                      {p.mesas ? `Mesa ${p.mesas.numero}` : 'Sin mesa'}
                    </p>
                    <p className="text-zinc-500 text-xs">{formatFecha(p.creado_en)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estado.cls}`}>
                    {estado.label}
                  </span>
                </div>
                <ul className="space-y-1 border-t border-zinc-800 pt-3">
                  {p.pedido_items.map((item, i) => (
                    <li key={i} className="flex justify-between text-sm">
                      <span className="text-zinc-400">{item.cantidad}× {item.productos?.nombre}</span>
                      <span className="text-zinc-500">{(item.precio_unit * item.cantidad).toFixed(2)} €</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-800">
                  <span className="text-zinc-500 text-xs">Total</span>
                  <span className="text-gold-400 font-bold">{Number(total).toFixed(2)} €</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
