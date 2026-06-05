'use client'

import { useState, useTransition } from 'react'
import { Crown, Users, Clock, CheckCircle } from 'lucide-react'
import { crearReserva } from '@/lib/actions/reservas'

const ESTILOS_SALA = {
  'Sala Roja': {
    color:  'from-red-900/40 to-red-800/20',
    borde:  'border-red-700/40',
    acento: 'text-red-400',
    badge:  'bg-red-500/20 text-red-400',
  },
  'Sala Negra': {
    color:  'from-zinc-800/60 to-zinc-900/40',
    borde:  'border-zinc-600/40',
    acento: 'text-zinc-300',
    badge:  'bg-zinc-600/30 text-zinc-400',
  },
  'Sala Gold': {
    color:  'from-yellow-900/40 to-amber-800/20',
    borde:  'border-gold-500/40',
    acento: 'text-gold-400',
    badge:  'bg-gold-500/20 text-gold-400',
  },
}

const ESTILOS_DEFAULT = {
  color:  'from-zinc-800/40 to-zinc-900/20',
  borde:  'border-zinc-700/40',
  acento: 'text-zinc-300',
  badge:  'bg-zinc-700/30 text-zinc-400',
}

const HORAS     = ['20:00', '21:00', '22:00', '23:00', '00:00', '01:00', '02:00']
const DURACIONES = ['1 hora', '2 horas', '3 horas', '4 horas']

export default function VipClient({ salas }) {
  const [salaSeleccionada, setSalaSeleccionada] = useState(null)
  const [fecha, setFecha]       = useState('')
  const [hora, setHora]         = useState('')
  const [duracion, setDuracion] = useState('')
  const [reservado, setReservado] = useState(false)
  const [error, setError]         = useState(null)
  const [isPending, startTransition] = useTransition()

  const sala   = salas.find((s) => s.id === salaSeleccionada)
  const horas  = duracion ? parseInt(duracion) : 0
  const subtotal = sala ? sala.precio_hora * horas : 0
  const puedeReservar = salaSeleccionada && fecha && hora && duracion && sala?.activa

  function reservar() {
    if (!puedeReservar) return
    setError(null)
    startTransition(async () => {
      try {
        await crearReserva({ sala_id: salaSeleccionada, fecha, hora, duracionHoras: horas })
        setReservado(true)
      } catch (err) {
        setError(err.message)
      }
    })
  }

  if (reservado) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-full gap-6">
        <CheckCircle size={64} className="text-emerald-400" />
        <div className="text-center">
          <h2 className="text-2xl font-bold text-zinc-100">¡Reserva confirmada!</h2>
          <p className="text-zinc-400 mt-2">{sala.nombre} · {fecha} · {hora} · {duracion}</p>
          <p className="text-gold-400 font-bold text-xl mt-2">{subtotal} € total</p>
        </div>
        <button
          onClick={() => { setReservado(false); setSalaSeleccionada(null); setFecha(''); setHora(''); setDuracion('') }}
          className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl text-sm"
        >
          Nueva reserva
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">Salas VIP</h1>
        <p className="text-zinc-500 text-sm mt-1">Reserva una sala privada para tu grupo</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {salas.map((s) => {
          const est = ESTILOS_SALA[s.nombre] ?? ESTILOS_DEFAULT
          return (
            <button
              key={s.id}
              onClick={() => s.activa && setSalaSeleccionada(s.id)}
              disabled={!s.activa}
              className={`bg-linear-to-br ${est.color} border ${est.borde} rounded-2xl p-6 text-left transition-all ${
                salaSeleccionada === s.id
                  ? 'ring-2 ring-gold-500 scale-[1.02]'
                  : s.activa ? 'hover:scale-[1.01] cursor-pointer' : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <Crown size={24} className={est.acento} />
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.activa ? est.badge : 'bg-zinc-700 text-zinc-500'}`}>
                  {s.activa ? 'Disponible' : 'Ocupada'}
                </span>
              </div>
              <h3 className={`text-lg font-bold mb-1 ${est.acento}`}>{s.nombre}</h3>
              <p className="text-zinc-400 text-xs mb-4 leading-relaxed">{s.descripcion}</p>
              <div className="flex items-center gap-4 text-zinc-500 text-xs">
                <span className="flex items-center gap-1"><Users size={12} /> Hasta {s.capacidad} personas</span>
                <span className="flex items-center gap-1"><Clock size={12} /> {s.precio_hora} €/h</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Formulario reserva */}
      <div className="max-w-lg">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">
          {salaSeleccionada ? `Reservar ${sala.nombre}` : 'Selecciona una sala'}
        </h2>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-zinc-500 text-xs block mb-1.5">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={!salaSeleccionada}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-gold-500 disabled:opacity-40"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-zinc-500 text-xs block mb-1.5">Hora de inicio</label>
              <select
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                disabled={!salaSeleccionada}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-gold-500 disabled:opacity-40"
              >
                <option value="">— Elegir —</option>
                {HORAS.map((h) => <option key={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="text-zinc-500 text-xs block mb-1.5">Duración</label>
              <select
                value={duracion}
                onChange={(e) => setDuracion(e.target.value)}
                disabled={!salaSeleccionada}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-gold-500 disabled:opacity-40"
              >
                <option value="">— Elegir —</option>
                {DURACIONES.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {subtotal > 0 && (
            <div className="flex justify-between items-center pt-2 border-t border-zinc-800">
              <span className="text-zinc-400 text-sm">Total estimado</span>
              <span className="text-gold-400 font-bold text-lg">{subtotal} €</span>
            </div>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            onClick={reservar}
            disabled={!puedeReservar || isPending}
            className="w-full py-2.5 bg-gold-500 hover:bg-gold-600 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-950 font-bold rounded-xl transition-colors"
          >
            {isPending ? 'Reservando…' : 'Confirmar reserva'}
          </button>
        </div>
      </div>
    </div>
  )
}
