import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from 'firebase/auth'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'
import { firebaseAuth } from '../../services/firebase/firebase.ts'
import { useToast } from '../../core/toast/ToastProvider.tsx'

export type AuthUser = Pick<User, 'uid' | 'displayName' | 'email' | 'photoURL'>

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const BYPASS_AUTH = import.meta.env.VITE_AUTH_BYPASS === 'true'
const BYPASS_USER: AuthUser = {
  uid: 'demo-user',
  displayName: 'Researcher Demo',
  email: 'demo@yachay.ai',
  photoURL: null,
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  useEffect(() => {
    if (BYPASS_AUTH) {
      setUser(BYPASS_USER)
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (firebaseUser) {
        const { uid, displayName, email, photoURL } = firebaseUser
        setUser({ uid, displayName, email, photoURL })
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    if (BYPASS_AUTH) return
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      try {
        await signInWithPopup(firebaseAuth, provider)
        showToast({ type: 'success', message: 'Sesión iniciada' })
      } catch (popupError) {
        console.warn('Popup sign-in blocked, falling back to redirect', popupError)
        await signInWithRedirect(firebaseAuth, provider)
      }
    } catch (error) {
      console.error('Google sign-in failed', error)
      showToast({ type: 'error', message: 'No pudimos iniciar sesión con Google' })
      throw error
    }
  }

  const handleSignOut = async () => {
    if (BYPASS_AUTH) return
    try {
      await signOut(firebaseAuth)
      showToast({ type: 'info', message: 'Sesión finalizada' })
    } catch (error) {
      console.error('Sign-out failed', error)
      showToast({ type: 'error', message: 'No pudimos cerrar la sesión' })
    }
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      signInWithGoogle,
      signOut: handleSignOut,
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
