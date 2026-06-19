import { createContext, useContext, useState, ReactNode } from 'react'
import { env } from '../config/env'

const USER_STORAGE_KEY = 'everyup_user'
// Legacy key — cleaned up on login/logout to remove any old tokens from localStorage
const LEGACY_TOKEN_KEY = 'everyup_jwt_token'

interface User {
  user_id: number
  username: string
  role: string
}

interface AuthContextType {
  user: User | null
  login: (user: User) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  function login(newUser: User) {
    // JWT token is now stored in httpOnly cookie by the backend — not in localStorage
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser))
    localStorage.removeItem(LEGACY_TOKEN_KEY) // Clean up legacy token
    setUser(newUser)
  }

  function logout() {
    localStorage.removeItem(USER_STORAGE_KEY)
    localStorage.removeItem(LEGACY_TOKEN_KEY)
    // Call backend to clear the httpOnly cookie
    fetch(`${env.apiBaseUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {}) // Best-effort
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
