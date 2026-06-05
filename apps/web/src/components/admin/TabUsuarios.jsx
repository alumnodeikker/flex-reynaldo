'use client'

import { useState, useTransition } from 'react'
import { Trash2, Edit2 } from 'lucide-react'
import { editarPerfil, borrarPerfil } from '@/lib/actions/adminPerfiles'
import ModalUsuario from './ModalUsuario'

const ROL_COLOR = {
  cliente: 'bg-blue-500/20 text-blue-400',
  staff: 'bg-amber-500/20 text-amber-400',
  portero: 'bg-purple-500/20 text-purple-400',
  admin: 'bg-red-500/20 text-red-400',
}

export default function TabUsuarios({ perfiles }) {
  const [editando, setEditando] = useState(null)
  const [error, setError] = useState(null)
  const [isPending, startTransition] = useTransition()

  function handleEditar(perfil) {
    setEditando({ id: perfil.id, nombre: perfil.nombre ?? '', rol: perfil.rol, activo: perfil.activo ?? true })
  }

  function handleGuardar() {
    startTransition(async () => {
      try {
        await editarPerfil(editando.id, { nombre: editando.nombre, rol: editando.rol, activo: editando.activo })
        setEditando(null)
      } catch (err) {
        setError(err.message)
      }
    })
  }

  function handleBorrar(id) {
    if (!confirm('¿Seguro que quieres eliminar este perfil? Esta acción no se puede deshacer.')) return
    startTransition(async () => {
      try {
        await borrarPerfil(id)
      } catch (err) {
        setError(err.message)
      }
    })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-zinc-100">Usuarios</h2>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {/* Tabla — desktop */}
      <div className="hidden sm:block bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
              <th className="text-left px-4 py-3">Nombre</th>
              <th className="text-left px-4 py-3">Rol</th>
              <th className="text-left px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {perfiles.map((p) => (
              <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="px-4 py-3 text-zinc-100 font-medium">{p.nombre ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROL_COLOR[p.rol] ?? 'bg-zinc-700 text-zinc-400'}`}>{p.rol}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.activo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-500'}`}>
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <button onClick={() => handleEditar(p)} disabled={isPending} className="text-zinc-600 hover:text-gold-400 transition-colors"><Edit2 size={15} /></button>
                    <button onClick={() => handleBorrar(p.id)} disabled={isPending} className="text-zinc-600 hover:text-red-400 transition-colors"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards — móvil */}
      <div className="sm:hidden space-y-3">
        {perfiles.map((p) => (
          <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-zinc-100 font-medium text-sm truncate">{p.nombre ?? '—'}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROL_COLOR[p.rol] ?? 'bg-zinc-700 text-zinc-400'}`}>{p.rol}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.activo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-500'}`}>
                  {p.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
            <div className="flex gap-3 shrink-0">
              <button onClick={() => handleEditar(p)} disabled={isPending} className="text-zinc-600 hover:text-gold-400 transition-colors"><Edit2 size={15} /></button>
              <button onClick={() => handleBorrar(p.id)} disabled={isPending} className="text-zinc-600 hover:text-red-400 transition-colors"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>

      {editando && (
        <ModalUsuario
          form={editando}
          setForm={setEditando}
          onGuardar={handleGuardar}
          onClose={() => setEditando(null)}
          isPending={isPending}
        />
      )}
    </div>
  )
}
