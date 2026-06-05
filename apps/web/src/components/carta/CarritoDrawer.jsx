'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCarritoStore } from '@/store/carritoStore'
import { ShoppingCart, X } from 'lucide-react'

export default function CarritoDrawer({ mesas = [] }) {
  const { items, eliminarItem, vaciarCarrito } = useCarritoStore()

  const totalItems = useCarritoStore((s) => s.items.reduce((acc, i) => acc + i.cantidad, 0))
  const total      = useCarritoStore((s) => s.items.reduce((acc, i) => acc + i.precio * i.cantidad, 0))

  const [carritoAbierto, setCarritoAbierto] = useState(false)
  const [pedidoEnviado, setPedidoEnviado]   = useState(false)
  const [modalMesa, setModalMesa]           = useState(false)
  const [mesaSel, setMesaSel]               = useState(null)
  const [enviando, setEnviando]             = useState(false)
  const [error, setError]                   = useState(null)

  const pisos = [...new Set(mesas.map((m) => m.piso))].sort()

  async function handleConfirmarPedido() {
    if (!mesaSel || items.length === 0) return

    setEnviando(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const totalPedido = items.reduce((sum, i) => sum + i.precio * i.cantidad, 0)

    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({ mesa_id: mesaSel.id, cliente_id: user?.id ?? null, estado: 'pendiente', total: totalPedido })
      .select('id')
      .single()

    if (pedidoError) {
      setError('No se pudo crear el pedido. Inténtalo de nuevo.')
      setEnviando(false)
      return
    }

    const { error: itemsError } = await supabase
      .from('pedido_items')
      .insert(
        items.map((i) => ({
          pedido_id:   pedido.id,
          producto_id: i.id,
          cantidad:    i.cantidad,
          precio_unit: i.precio,
        }))
      )

    if (itemsError) {
      setError('El pedido se creó pero hubo un problema al guardar los productos.')
      setEnviando(false)
      return
    }

    setModalMesa(false)
    setPedidoEnviado(true)
    vaciarCarrito()
    setMesaSel(null)
    setEnviando(false)

    setTimeout(() => {
      setPedidoEnviado(false)
      setCarritoAbierto(false)
    }, 3000)
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setCarritoAbierto(true)}
        className="fixed top-20 right-10 md:top-auto md:bottom-6 md:right-6 z-50 w-14 h-14 bg-gold-500 hover:bg-gold-600 text-zinc-950 rounded-full shadow-lg flex items-center justify-center transition-colors"
      >
        <ShoppingCart size={22} />
        {totalItems > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-950 text-gold-400 text-xs font-bold rounded-full flex items-center justify-center border border-gold-500">
            {totalItems}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {carritoAbierto && (
        <div className="fixed inset-0 bg-black/50 z-20" onClick={() => setCarritoAbierto(false)} />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-30 w-full sm:w-96 bg-zinc-900 border-l border-zinc-800 flex flex-col transition-transform duration-300 ${
          carritoAbierto ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="px-6 py-5 border-b border-zinc-800 flex items-center gap-2">
          <ShoppingCart size={18} className="text-gold-400" />
          <h2 className="font-semibold text-zinc-100">Mi pedido</h2>
          {totalItems > 0 && (
            <span className="bg-gold-500 text-zinc-950 text-xs font-bold px-2 py-0.5 rounded-full">{totalItems}</span>
          )}
          <button onClick={() => setCarritoAbierto(false)} className="ml-auto text-zinc-500 hover:text-zinc-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {pedidoEnviado && (
            <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-sm rounded-lg px-4 py-3 mb-4">
              ¡Pedido enviado! Llega en 10–15 min.
            </div>
          )}
          {items.length === 0 && !pedidoEnviado ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <ShoppingCart size={40} className="text-zinc-700" />
              <p className="text-zinc-500 text-sm">Tu pedido está vacío</p>
              <p className="text-zinc-600 text-xs">Añade productos desde el catálogo</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 bg-zinc-800/50 rounded-xl px-3 py-3">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-700 shrink-0">
                    {item.imagen_url ? (
                      <img src={item.imagen_url} alt={item.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-100 font-medium truncate">{item.nombre}</p>
                    <p className="text-xs text-zinc-500">{item.cantidad} × {item.precio.toFixed(2)} €</p>
                  </div>
                  <span className="text-sm text-gold-400 font-semibold shrink-0">
                    {(item.precio * item.cantidad).toFixed(2)} €
                  </span>
                  <button onClick={() => eliminarItem(item.id)} className="text-zinc-600 hover:text-red-400 transition-colors shrink-0">
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="px-4 py-4 border-t border-zinc-800">
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <div className="flex justify-between items-center mb-4">
              <span className="text-zinc-400 text-sm">Total</span>
              <span className="text-zinc-100 font-bold text-xl">{total.toFixed(2)} €</span>
            </div>
            <button
              onClick={() => { setError(null); setModalMesa(true) }}
              className="w-full py-3 bg-gold-500 hover:bg-gold-600 text-zinc-950 font-bold rounded-xl transition-colors"
            >
              Enviar pedido
            </button>
          </div>
        )}
      </div>

      {/* Modal selector de mesa */}
      {modalMesa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setModalMesa(false)} />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-zinc-100">¿En qué mesa estás?</h2>
              <button onClick={() => setModalMesa(false)} className="text-zinc-500 hover:text-zinc-100">
                <X size={18} />
              </button>
            </div>
            <p className="text-zinc-500 text-sm mb-5">Toca tu mesa para seleccionarla.</p>

            <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
              {pisos.map((piso) => (
                <div key={piso}>
                  <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Piso {piso}</p>
                  <div className="grid grid-cols-5 gap-2">
                    {mesas.filter((m) => m.piso === piso).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMesaSel(m)}
                        className={`aspect-square rounded-xl text-sm font-bold transition-colors border ${
                          mesaSel?.id === m.id
                            ? 'bg-gold-500 text-zinc-950 border-gold-500'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-gold-500 hover:text-gold-400'
                        }`}
                      >
                        {m.numero}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-red-400 text-xs mt-4">{error}</p>}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setModalMesa(false)}
                className="flex-1 py-2.5 border border-zinc-700 text-zinc-400 hover:bg-zinc-800 rounded-xl text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarPedido}
                disabled={!mesaSel || enviando}
                className="flex-1 py-2.5 bg-gold-500 hover:bg-gold-600 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-bold rounded-xl text-sm transition-colors"
              >
                {enviando ? 'Enviando…' : mesaSel ? `Mesa ${mesaSel.numero}` : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
