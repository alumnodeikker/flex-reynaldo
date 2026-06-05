'use client'

import { useState } from 'react'
import ProductoCard from './ProductoCard'
import CarritoDrawer from './CarritoDrawer'

const CATEGORIAS = ['Todo', 'Bebida', 'Comida', 'Pack']

export default function CartaClient({ productos, mesas }) {
  const [cat, setCat] = useState('Todo')

  const productosFiltrados =
    cat === 'Todo'
      ? productos
      : productos.filter((p) => p.categoria.toLowerCase() === cat.toLowerCase())

  return (
    <div className="relative min-h-full">
      <div className="p-4 sm:p-8">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">Pedir a mesa</h1>
          <p className="text-zinc-500 text-sm mt-1">Selecciona productos y confirma tu pedido</p>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {CATEGORIAS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${cat === c
                  ? 'bg-gold-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Grid productos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-24">
          {productosFiltrados.map((p) => (
            <ProductoCard key={p.id} producto={p} />
          ))}
        </div>
      </div>

      <CarritoDrawer mesas={mesas} />
    </div>
  )
}
