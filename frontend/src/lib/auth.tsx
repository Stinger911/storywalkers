import {
  createContext,
  createSignal,
  onCleanup,
  useContext,
  type JSX,
} from 'solid-js'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'

import { apiFetch, setUnauthorizedHandler } from './api'
import { auth } from './firebase'

export type MeProfile = {
  uid: string
  email: string
  displayName: string
  role: 'student' | 'staff'
  status: 'active' | 'disabled'
  roleRaw?: 'student' | 'admin' | 'expert'
}

type AuthContextValue = {
  firebaseUser: () => User | null
  me: () => MeProfile | null
  loading: () => boolean
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>()

export function AuthProvider(props: { children: JSX.Element }) {
  const [firebaseUser, setFirebaseUser] = createSignal<User | null>(null)
  const [me, setMe] = createSignal<MeProfile | null>(null)
  const [loading, setLoading] = createSignal(true)

  const refreshMe = async () => {
    if (!auth.currentUser) {
      setMe(null)
      return
    }

    const response = await apiFetch('/api/me')
    if (response.ok) {
      const data = (await response.json()) as MeProfile
      setMe(data)
    } else if (response.status === 401) {
      await signOut(auth)
      setMe(null)
    }
  }

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  const logout = async () => {
    await signOut(auth)
    setMe(null)
  }

  setUnauthorizedHandler(() => {
    void logout()
  })

  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    setFirebaseUser(user)
    if (!user) {
      setMe(null)
      setLoading(false)
      return
    }

    setLoading(true)
    await refreshMe()
    setLoading(false)
  })

  onCleanup(() => unsubscribe())

  const value: AuthContextValue = {
    firebaseUser,
    me,
    loading,
    loginWithGoogle,
    logout,
    refreshMe,
  }

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
