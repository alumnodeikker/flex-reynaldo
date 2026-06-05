'use client'

import { useState } from 'react'
import TabUsuarios from './TabUsuarios'
import TabProductos from './TabProductos'

const TABS = ['Usuarios', 'Productos']

export default function AdminClient({ productosIniciales, perfilesIniciales }) {
  const [tab, setTab] = useState('Usuarios')

  const productosActivos = productosIniciales.filter((p) => p.disponible).length

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">Panel de administración</h1>
        <p className="text-zinc-500 text-sm mt-1">Gestión de usuarios y productos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Usuarios totales',  valor: perfilesIniciales.length },
          { label: 'Productos',         valor: productosIniciales.length },
          { label: 'Productos activos', valor: productosActivos },
        ].map((stat) => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs">{stat.label}</p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">{stat.valor}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t ? 'bg-gold-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Usuarios' && <TabUsuarios perfiles={perfilesIniciales} />}
      {tab === 'Productos' && <TabProductos productos={productosIniciales} />}
    </div>
  )
}
