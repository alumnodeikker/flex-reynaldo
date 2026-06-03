'use client'

import { useState } from 'react'
import { Camera, Lock, Bell, Shield, LogOut, CheckCircle, CreditCard, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logout } from '@/lib/actions/auth'

const TABS = [
  { id: 'personal', label: 'Datos personales' },
  { id: 'pago', label: 'Pago' },
  { id: 'seguridad', label: 'Seguridad' },
  { id: 'notificaciones', label: 'Notificaciones' },
]

const TARJETAS_INIT = [
  { id: 1, tipo: 'Visa', ultimos: '4242', expira: '12/27', predeterminada: true },
  { id: 2, tipo: 'Mastercard', ultimos: '8210', expira: '09/26', predeterminada: false },
]

const LABEL_ROL = { cliente: 'Cliente', staff: 'Staff', portero: 'Portero', admin: 'Admin' }

function iconoRed(tipo) {
  if (tipo === 'Visa') return <span className="text-blue-400 font-black italic text-sm tracking-tight">VISA</span>
  return <span className="text-red-400 font-black text-xs">MC</span>
}

export default function PerfilClient({ nombre, email, rol, avatarUrl }) {
  const [tab, setTab] = useState('personal')
  const [guardado, setGuardado] = useState(false)
  const [avatar, setAvatar] = useState(avatarUrl)
  const router = useRouter()

  const [perfil, setPerfil] = useState({ nombre, email, telefono: '', fechaNac: '' })
  const [pass, setPass] = useState({ actual: '', nueva: '', confirmar: '' })
  const [tarjetas, setTarjetas] = useState(TARJETAS_INIT)
  const [nuevaTarjeta, setNuevaTarjeta] = useState(false)
  const [formTarjeta, setFormTarjeta] = useState({ numero: '', titular: '', expira: '', cvv: '' })
  const [notifs, setNotifs] = useState({ pedidos: true, entradas: true, ofertas: false, vip: true, newsletter: false })

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function agregarTarjeta(e) {
    e.preventDefault()
    const ultimos = formTarjeta.numero.replace(/\s/g, '').slice(-4)
    const tipo = formTarjeta.numero.startsWith('4') ? 'Visa' : 'Mastercard'
    setTarjetas(prev => [...prev, { id: Date.now(), tipo, ultimos, expira: formTarjeta.expira, predeterminada: false }])
    setFormTarjeta({ numero: '', titular: '', expira: '', cvv: '' })
    setNuevaTarjeta(false)
  }

  function eliminarTarjeta(id) { setTarjetas(prev => prev.filter(t => t.id !== id)) }
  function predeterminar(id) { setTarjetas(prev => prev.map(t => ({ ...t, predeterminada: t.id === id }))) }

  function guardar(e) {
    e.preventDefault()
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2500)
  }

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className='mb-8 justify-self-end'>
        <form action={logout}>
          <button className="flex items-center gap-2 px-4 py-2 border border-red-500/40 text-red-400 hover:bg-red-500/10 rounded-xl text-sm transition-colors">
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </form>
      </div>

      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">Mi perfil</h1>
        <p className="text-zinc-500 text-sm mt-1">Gestiona tu cuenta y preferencias</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-5 mb-8">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gold-500/20 border-2 border-gold-500/40 overflow-hidden flex items-center justify-center">
            {avatar
              ? <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
              : <span className="text-3xl font-bold text-gold-400">{nombre?.[0]?.toUpperCase() ?? '?'}</span>
            }
          </div>
          <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-gold-500 hover:bg-gold-600 rounded-full flex items-center justify-center cursor-pointer transition-colors">
            <Camera size={13} className="text-zinc-950" />
            <input type="file" accept="image/*" className="hidden" onChange={e => {
              const f = e.target.files?.[0]
              if (f) setAvatar(URL.createObjectURL(f))
            }} />
          </label>
        </div>
        <div>
          <p className="text-zinc-100 font-semibold">{perfil.nombre}</p>
          <p className="text-zinc-500 text-sm">{perfil.email}</p>
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full mt-1 inline-block">
            {LABEL_ROL[rol] ?? 'Cliente'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === t.id ? 'bg-gold-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Toast */}
      {guardado && (
        <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-sm rounded-xl px-4 py-3 mb-6">
          <CheckCircle size={16} /> Cambios guardados correctamente
        </div>
      )}

      {/* Personal */}
      {tab === 'personal' && (
        <form onSubmit={guardar} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'nombre', label: 'Nombre completo', type: 'text' },
              { key: 'telefono', label: 'Teléfono', type: 'text' },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="text-zinc-500 text-xs block mb-1.5">{label}</label>
                <input type={type} value={perfil[key]}
                  onChange={e => setPerfil(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-gold-500 transition-colors"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="text-zinc-500 text-xs block mb-1.5">Email</label>
            <input type="email" value={perfil.email}
              onChange={e => setPerfil(p => ({ ...p, email: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-gold-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-zinc-500 text-xs block mb-1.5">Fecha de nacimiento</label>
            <input type="date" value={perfil.fechaNac}
              onChange={e => setPerfil(p => ({ ...p, fechaNac: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-gold-500 transition-colors"
            />
          </div>
          <button type="submit" className="px-6 py-2.5 bg-gold-500 hover:bg-gold-600 text-zinc-950 font-bold rounded-xl text-sm transition-colors">
            Guardar cambios
          </button>
        </form>
      )}

      {/* Pago */}
      {tab === 'pago' && (
        <div className="space-y-4">
          {tarjetas.map(t => (
            <div key={t.id} className={`bg-zinc-900 border rounded-2xl p-5 flex items-center gap-4 ${t.predeterminada ? 'border-gold-500/50' : 'border-zinc-800'}`}>
              <div className="w-14 h-10 bg-zinc-800 rounded-lg flex items-center justify-center shrink-0 border border-zinc-700">
                {iconoRed(t.tipo)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-zinc-100 text-sm font-medium">{t.tipo} •••• {t.ultimos}</p>
                <p className="text-zinc-500 text-xs">Expira {t.expira}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {t.predeterminada
                  ? <span className="text-xs bg-gold-500/20 text-gold-400 px-2 py-0.5 rounded-full">Predeterminada</span>
                  : <button onClick={() => predeterminar(t.id)} className="text-xs text-zinc-500 hover:text-gold-400 transition-colors">Usar por defecto</button>
                }
                <button onClick={() => eliminarTarjeta(t.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}

          {nuevaTarjeta ? (
            <form onSubmit={agregarTarjeta} className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={16} className="text-gold-400" />
                <h3 className="text-zinc-100 font-semibold text-sm">Nueva tarjeta</h3>
              </div>
              <div className="h-36 bg-linear-to-br from-zinc-700 to-zinc-800 rounded-xl p-5 flex flex-col justify-between border border-zinc-600 mb-2">
                <div className="flex justify-between items-start">
                  <div className="w-8 h-6 bg-gold-500/60 rounded-sm" />
                  {iconoRed(formTarjeta.numero.startsWith('4') ? 'Visa' : 'Mastercard')}
                </div>
                <div>
                  <p className="text-zinc-300 font-mono text-sm tracking-widest">
                    {formTarjeta.numero || '•••• •••• •••• ••••'}
                  </p>
                  <div className="flex justify-between mt-1">
                    <p className="text-zinc-400 text-xs">{formTarjeta.titular || 'TITULAR'}</p>
                    <p className="text-zinc-400 text-xs">{formTarjeta.expira || 'MM/AA'}</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-zinc-500 text-xs block mb-1.5">Número de tarjeta</label>
                <input placeholder="1234 5678 9012 3456" value={formTarjeta.numero}
                  onChange={e => setFormTarjeta(p => ({ ...p, numero: e.target.value }))} maxLength={19}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 font-mono outline-none focus:border-gold-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-zinc-500 text-xs block mb-1.5">Titular</label>
                <input placeholder="ALEX GARCÍA" value={formTarjeta.titular}
                  onChange={e => setFormTarjeta(p => ({ ...p, titular: e.target.value.toUpperCase() }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-gold-500 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-500 text-xs block mb-1.5">Caducidad</label>
                  <input placeholder="MM/AA" value={formTarjeta.expira}
                    onChange={e => setFormTarjeta(p => ({ ...p, expira: e.target.value }))} maxLength={5}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 font-mono outline-none focus:border-gold-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 text-xs block mb-1.5">CVV</label>
                  <input placeholder="•••" type="password" value={formTarjeta.cvv}
                    onChange={e => setFormTarjeta(p => ({ ...p, cvv: e.target.value }))} maxLength={4}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 font-mono outline-none focus:border-gold-500 transition-colors"
                  />
                </div>
              </div>
              <p className="text-zinc-600 text-xs flex items-center gap-1.5">
                <Shield size={11} /> Los datos se procesarán de forma segura con Stripe. Flex no almacena tu número de tarjeta.
              </p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setNuevaTarjeta(false)}
                  className="flex-1 py-2.5 border border-zinc-700 text-zinc-400 hover:bg-zinc-800 rounded-xl text-sm transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-gold-500 hover:bg-gold-600 text-zinc-950 font-bold rounded-xl text-sm transition-colors">
                  Guardar tarjeta
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setNuevaTarjeta(true)}
              className="w-full py-3 border border-dashed border-zinc-700 hover:border-gold-500/50 text-zinc-500 hover:text-gold-400 rounded-2xl text-sm flex items-center justify-center gap-2 transition-colors">
              <Plus size={16} /> Añadir tarjeta
            </button>
          )}
        </div>
      )}

      {/* Seguridad */}
      {tab === 'seguridad' && (
        <div className="space-y-4">
          <form onSubmit={guardar} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock size={16} className="text-gold-400" />
              <h3 className="text-zinc-100 font-semibold text-sm">Cambiar contraseña</h3>
            </div>
            {[
              { key: 'actual', label: 'Contraseña actual' },
              { key: 'nueva', label: 'Nueva contraseña' },
              { key: 'confirmar', label: 'Confirmar nueva contraseña' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-zinc-500 text-xs block mb-1.5">{label}</label>
                <input type="password" placeholder="••••••••" value={pass[key]}
                  onChange={e => setPass(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-gold-500 transition-colors"
                />
              </div>
            ))}
            <button type="submit" className="px-6 py-2.5 bg-gold-500 hover:bg-gold-600 text-zinc-950 font-bold rounded-xl text-sm transition-colors">
              Actualizar contraseña
            </button>
          </form>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-gold-400" />
              <h3 className="text-zinc-100 font-semibold text-sm">Sesiones activas</h3>
            </div>
            {[
              { dispositivo: 'Chrome · Windows', lugar: 'Madrid, España', activo: true },
              { dispositivo: 'Safari · iPhone', lugar: 'Madrid, España', activo: false },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-t border-zinc-800 first:border-t-0">
                <div>
                  <p className="text-zinc-100 text-sm">{s.dispositivo}</p>
                  <p className="text-zinc-500 text-xs">{s.lugar}</p>
                </div>
                {s.activo
                  ? <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Actual</span>
                  : <button className="text-xs text-red-400 hover:text-red-300">Cerrar</button>
                }
              </div>
            ))}
          </div>

          <div className="bg-zinc-900 border border-red-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <LogOut size={16} className="text-red-400" />
              <h3 className="text-zinc-100 font-semibold text-sm">Zona de peligro</h3>
            </div>
            <p className="text-zinc-500 text-xs mb-4">Estas acciones son irreversibles.</p>
            <button className="px-4 py-2 border border-red-500/40 text-red-400 hover:bg-red-500/10 rounded-xl text-sm transition-colors">
              Eliminar cuenta
            </button>
          </div>
        </div>
      )}

      {/* Notificaciones */}
      {tab === 'notificaciones' && (
        <form onSubmit={guardar} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Bell size={16} className="text-gold-400" />
            <h3 className="text-zinc-100 font-semibold text-sm">Preferencias de notificación</h3>
          </div>
          <div className="divide-y divide-zinc-800">
            {[
              { key: 'pedidos', label: 'Estado de pedidos', desc: 'Cuando tu pedido esté listo o en camino' },
              { key: 'entradas', label: 'Entradas y reservas', desc: 'Confirmaciones y recordatorios' },
              { key: 'vip', label: 'Salas VIP', desc: 'Disponibilidad y ofertas de salas' },
              { key: 'ofertas', label: 'Promociones', desc: 'Descuentos y eventos especiales' },
              { key: 'newsletter', label: 'Newsletter', desc: 'Novedades mensuales de Flex' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-4">
                <div>
                  <p className="text-zinc-100 text-sm font-medium">{label}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">{desc}</p>
                </div>
                <button type="button"
                  onClick={() => setNotifs(n => ({ ...n, [key]: !n[key] }))}
                  className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ml-4 ${notifs[key] ? 'bg-gold-500' : 'bg-zinc-700'}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${notifs[key] ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            ))}
          </div>
          <button type="submit" className="px-6 py-2.5 bg-gold-500 hover:bg-gold-600 text-zinc-950 font-bold rounded-xl text-sm transition-colors mt-4">
            Guardar preferencias
          </button>
        </form>
      )}
    </div>
  )
}
