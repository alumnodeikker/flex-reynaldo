'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import { crearProducto, editarProducto, borrarProducto } from '@/lib/actions/productos'
import ModalProducto from './ModalProducto'

const VACIO = { nombre: '', descripcion: '', precio: '', categoria: 'bebida', disponible: true, imagen: null, imagen_url: null }

export default function TabProductos({ productos }) {
  const [formP, setFormP]           = useState(VACIO)
  const [editandoId, setEditandoId] = useState(null)
  const [modal, setModal]           = useState(false)
  const [error, setError]           = useState(null)
  const [isPending, startTransition] = useTransition()

  function abrirCrear() {
    setFormP(VACIO)
    setEditandoId(null)
    setError(null)
    setModal(true)
  }

  function abrirEditar(p) {
    setFormP({ nombre: p.nombre, descripcion: p.descripcion ?? '', precio: p.precio, categoria: p.categoria, disponible: p.disponible, imagen: null, imagen_url: p.imagen_url ?? null })
    setEditandoId(p.id)
    setError(null)
    setModal(true)
  }

  function cerrar() {
    setModal(false)
    setFormP(VACIO)
    setEditandoId(null)
    setError(null)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const data = new FormData()
    data.set('nombre',      formP.nombre)
    data.set('descripcion', formP.descripcion)
    data.set('precio',      String(formP.precio))
    data.set('categoria',   formP.categoria)
    data.set('disponible',  String(formP.disponible))
    if (formP.imagen) data.set('imagen', formP.imagen)

    startTransition(async () => {
      try {
        if (editandoId) {
          await editarProducto(editandoId, data)
        } else {
          await crearProducto(data)
        }
        cerrar()
      } catch (err) {
        setError(err.message)
      }
    })
  }

  function handleBorrar(id) {
    if (!confirm('¿Seguro que quieres borrar este producto?')) return
    startTransition(async () => {
      try {
        await borrarProducto(id)
      } catch (err) {
        setError(err.message)
      }
    })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-zinc-100">Productos</h2>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 px-4 py-2 bg-gold-500 hover:bg-gold-600 text-zinc-950 text-sm font-semibold rounded-lg"
        >
          <Plus size={16} /> Nuevo producto
        </button>
      </div>

      {error && !modal && <p className="text-red-400 text-xs mb-3">{error}</p>}

      {/* Tabla — desktop */}
      <div className="hidden sm:block bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
              <th className="text-left px-4 py-3">Nombre</th>
              <th className="text-left px-4 py-3">Categoría</th>
              <th className="text-left px-4 py-3">Precio</th>
              <th className="text-left px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="px-4 py-3 text-zinc-100 font-medium">{p.nombre}</td>
                <td className="px-4 py-3 text-zinc-400 capitalize">{p.categoria}</td>
                <td className="px-4 py-3 text-gold-400 font-semibold">{p.precio.toFixed(2)} €</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.disponible ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-500'}`}>
                    {p.disponible ? 'Disponible' : 'Agotado'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => abrirEditar(p)} className="text-zinc-500 hover:text-blue-400 transition-colors"><Edit2 size={14} /></button>
                    <button onClick={() => handleBorrar(p.id)} disabled={isPending} className="text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-40"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards — móvil */}
      <div className="sm:hidden space-y-3">
        {productos.map((p) => (
          <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-zinc-100 font-medium text-sm truncate">{p.nombre}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-zinc-500 text-xs capitalize">{p.categoria}</span>
                <span className="text-gold-400 text-xs font-semibold">{p.precio.toFixed(2)} €</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.disponible ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-500'}`}>
                  {p.disponible ? 'Disponible' : 'Agotado'}
                </span>
              </div>
            </div>
            <div className="flex gap-3 shrink-0">
              <button onClick={() => abrirEditar(p)} className="text-zinc-500 hover:text-blue-400 transition-colors"><Edit2 size={14} /></button>
              <button onClick={() => handleBorrar(p.id)} disabled={isPending} className="text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-40"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <ModalProducto
          formP={formP}
          setFormP={setFormP}
          editandoId={editandoId}
          isPending={isPending}
          error={error}
          onSubmit={handleSubmit}
          onClose={cerrar}
        />
      )}
    </div>
  )
}
