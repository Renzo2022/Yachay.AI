import type { ReactNode } from 'react'
import { ToastProvider } from '../../core/toast/ToastProvider.tsx'
import { AuthProvider } from '../../features/auth/AuthContext.tsx'

type AppProvidersProps = {
  children: ReactNode
}

export const AppProviders = ({ children }: AppProvidersProps) => (
  <ToastProvider>
    <AuthProvider>{children}</AuthProvider>
  </ToastProvider>
)
