export default function CuentaDesactivada() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🚫</span>
        </div>
        <h1 className="text-xl font-bold text-zinc-100 mb-2">Cuenta desactivada</h1>
        <p className="text-zinc-500 text-sm">Tu cuenta ha sido desactivada. Contacta con el administrador para más información.</p>
      </div>
    </div>
  )
}
