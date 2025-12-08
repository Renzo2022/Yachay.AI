import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext.tsx'
import { BrutalButton } from '../../core/ui-kit/BrutalButton.tsx'

export const LoginView = () => {
  const { user, loading, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!loading && user) {
      const redirectTo = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard'
      navigate(redirectTo, { replace: true })
    }
  }, [loading, user, navigate, location.state])

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center font-mono text-xl">
        preparando consola...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        <p className="text-sm font-mono uppercase tracking-[0.6em] text-accent-secondary">Yachay AI</p>
        <h1 className="text-4xl font-black uppercase mt-4">Centro de Control Neo-Brutalista</h1>
        <p className="text-lg font-mono text-neutral-200 mt-4">
          Autentícate para sincronizar tus proyectos PRISMA y recuperar el progreso guardado en Firestore.
        </p>
      </div>

      <BrutalButton
        variant="primary"
        className="bg-accent-secondary text-black text-lg px-8 py-4"
        onClick={signInWithGoogle}
      >
        Ingresar con Google
      </BrutalButton>
    </div>
  )
}
