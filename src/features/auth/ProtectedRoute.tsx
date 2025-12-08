import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext.tsx'

export const ProtectedRoute = () => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center font-mono text-xl">
        Verificando sesión...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
