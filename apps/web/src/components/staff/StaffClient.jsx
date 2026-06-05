'use client'

import { useState, useTransition } from 'react'
import PedidoCard from './PedidoCard'
import { avanzarPedido } from '@/lib/actions/pedidos'

const FILTROS = ['todos', 'pendiente', 'en_barra', 'listo', 'entregado']

const LABEL_FILTRO = {
  todos:    'Todos',
  pendiente: 'Pendiente',
  en_barra:  'Preparando',
  listo:     'Listo',
  entregado: 'Entregado',
}

export default function StaffClient({ pedidosIniciales }) {
  const [pedidos, setPedidos]     = useState(pedidosIniciales)
  const [filtro, setFiltro]       = useState('todos')
  const [isPending, startTransition] = useTransition()

  function avanzar(id, estadoActual) {
    const SIGUIENTE = { pendiente: 'en_barra', en_barra: 'listo', listo: 'entregado' }
    const siguiente = SIGUIENTE[estadoActual]
    if (!siguiente) return

    // Optimistic update
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: siguiente } : p))

    startTransition(async () => {
      try {
        await avanzarPedido(id, estadoActual)
      } catch {
        // Revert on error
        setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: estadoActual } : p))
      }
    })
  }

  const pedidosFiltrados = filtro === 'todos' ? pedidos : pedidos.filter(p => p.estado === filtro)
  const pendientes  = pedidos.filter(p => p.estado === 'pendiente').length
  const preparando  = pedidos.filter(p => p.estado === 'en_barra').length
  const listos      = pedidos.filter(p => p.estado === 'listo').length
  const completados = pedidos.filter(p => p.estado === 'entregado').length

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">Panel de Staff</h1>
          <p className="text-zinc-500 text-sm mt-1">Gestión de pedidos en tiempo real</p>
        </div>
        {pendientes > 0 && (
          <div className="bg-amber-500/20 border border-amber-500/40 text-amber-400 text-sm px-4 py-2 rounded-xl self-start">
            {pendientes} nuevo{pendientes > 1 ? 's' : ''} pedido{pendientes > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-500 text-xs">Total</p>
          <p className="text-2xl font-bold text-zinc-100 mt-1">{pedidos.length}</p>
        </div>
        <div className="bg-zinc-900 border border-amber-500/20 rounded-xl p-4">
          <p className="text-zinc-500 text-xs">Pendientes</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{pendientes}</p>
        </div>
        <div className="bg-zinc-900 border border-blue-500/20 rounded-xl p-4">
          <p className="text-zinc-500 text-xs">Preparando</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{preparando + listos}</p>
        </div>
        <div className="bg-zinc-900 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-zinc-500 text-xs">Completados</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{completados}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTROS.map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filtro === f ? 'bg-gold-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {LABEL_FILTRO[f]}
          </button>
        ))}
      </div>

      {/* Lista pedidos */}
      <div className="space-y-3">
        {pedidosFiltrados.map(pedido => (
          <PedidoCard key={pedido.id} pedido={pedido} onAvanzar={avanzar} />
        ))}
        {pedidosFiltrados.length === 0 && (
          <p className="text-zinc-500 text-sm">No hay pedidos.</p>
        )}
      </div>
    </div>
  )
}
