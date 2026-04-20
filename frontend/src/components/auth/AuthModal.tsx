'use client'
import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/store'

interface Props { onClose: () => void }

export function AuthModal({ onClose }: Props) {
  const setAuth = useStore(s => s.setAuth)
  const lang    = useStore(s => s.lang)
  const [tab, setTab]         = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const T = {
    login:    lang === 'sv' ? 'Logga in'        : 'Log in',
    register: lang === 'sv' ? 'Registrera'      : 'Register',
    username: lang === 'sv' ? 'Användarnamn'    : 'Username',
    password: lang === 'sv' ? 'Lösenord'        : 'Password',
    create:   lang === 'sv' ? 'Skapa konto'     : 'Create account',
    errServer: lang === 'sv' ? 'Kunde inte nå servern' : 'Could not reach server',
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch(`/api/auth/${tab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (!data.ok) { setError(data.detail ?? data.error ?? (lang === 'sv' ? 'Fel' : 'Error')); setLoading(false); return }
      setAuth({ userId: data.user_id, username: data.username })
      onClose()
    } catch {
      setError(T.errServer)
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <div className="modal-tabs">
          <button className={`modal-tab${tab === 'login' ? ' active' : ''}`} onClick={() => { setTab('login'); setError('') }}>{T.login}</button>
          <button className={`modal-tab${tab === 'register' ? ' active' : ''}`} onClick={() => { setTab('register'); setError('') }}>{T.register}</button>
        </div>
        <form className="modal-form" onSubmit={submit}>
          <input
            ref={inputRef}
            className="modal-input"
            type="text"
            placeholder={T.username}
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          <input
            className="modal-input"
            type="password"
            placeholder={T.password}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            required
          />
          {error && <div className="modal-error">{error}</div>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? '...' : tab === 'login' ? T.login : T.create}
          </button>
        </form>
      </div>
    </div>
  )
}
