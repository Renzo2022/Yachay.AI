import { Outlet } from 'react-router-dom'
import { BrutalButton } from '../ui-kit/BrutalButton.tsx'
import { useAuth } from '../../features/auth/AuthContext.tsx'

export const AppLayout = () => {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 flex flex-col">
      <header className="border-b-4 border-black bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-neutral-700">Yachay AI</span>
          <h1 className="text-2xl font-bold">Centro de Comando de Revisión Sistemática</h1>
        </div>
        <BrutalButton variant="secondary" onClick={signOut}>
          Cerrar sesión
        </BrutalButton>
      </header>

      <main className="flex-1 px-6 py-8 bg-neutral-100">
        <div className="max-w-6xl mx-auto border-4 border-black bg-white shadow-[8px_8px_0_0_#111] p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
