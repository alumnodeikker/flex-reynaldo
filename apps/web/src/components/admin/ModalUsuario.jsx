'use client'

import { X } from 'lucide-react'

const ROLES = ['cliente', 'staff', 'portero', 'admin']

export default function ModalUsuario({ form, setForm, onGuardar, onClose, isPending }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-96">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-zinc-100">Editar perfil</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <input
            placeholder="Nombre completo"
            value={form.nombre}
            onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-gold-500"
          />
          <select
            value={form.rol}
            onChange={(e) => setForm((p) => ({ ...p, rol: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-gold-500"
          >
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
          <div className="flex items-center justify-between bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2">
            <span className="text-sm text-zinc-300">Cuenta activa</span>
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, activo: !p.activo }))}
              className={`relative w-10 h-6 rounded-full transition-colors ${form.activo ? 'bg-emerald-500' : 'bg-zinc-600'}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${form.activo ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            onClick={onGuardar}
            disabled={isPending}
            className="flex-1 py-2 rounded-lg bg-gold-500 hover:bg-gold-600 text-zinc-950 text-sm font-semibold disabled:opacity-50"
          >
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
