'use client'
import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/store'
import { drawAll } from '@/lib/canvas-registry'

interface Props {
  onAuthClick: () => void
  onDashboard: () => void
  onHome: () => void
}

export function TopBar({ onAuthClick, onDashboard, onHome }: Props) {
  const lang    = useStore(s => s.lang)
  const is3D    = useStore(s => s.is3D)
  const auth    = useStore(s => s.auth)
  const setLang = useStore(s => s.setLang)
  const setIs3D = useStore(s => s.setIs3D)
  const setAuth = useStore(s => s.setAuth)

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.ok) setAuth({ userId: d.user_id, username: d.username })
    }).catch(() => {})
  }, [setAuth])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setAuth(null)
    setMenuOpen(false)
  }

  function close() { setMenuOpen(false) }

  return (
    <header className="top-bar">
      <div className="logo-btn" onClick={onHome} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onHome()}>
        <svg className="logo-icon" viewBox="0 0 52 26" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">
          <path d="M 26,13 C 26,4 50,4 50,13 C 50,22 26,22 26,13 C 26,4 2,4 2,13 C 2,22 26,22 26,13"
            stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <h1>Resolvent</h1>
      </div>

      {/* Desktop controls */}
      <div className="top-controls top-controls--desktop">
        <div className="dim-toggle">
          {(['2d', '3d'] as const).map(dim => (
            <button
              key={dim}
              className={'dim-btn' + (is3D === (dim === '3d') ? ' active' : '')}
              onClick={() => { setIs3D(dim === '3d'); drawAll() }}
            >
              {dim.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="lang-toggle">
          {(['en', 'sv'] as const).map(l => (
            <button
              key={l}
              className={'lang-btn' + (lang === l ? ' active' : '')}
              onClick={() => setLang(l)}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        {auth ? (
          <div className="auth-controls">
            <button className="auth-dashboard-btn" onClick={onDashboard}>{auth.username}</button>
            <button className="auth-logout-btn" onClick={logout}>Log out</button>
          </div>
        ) : (
          <button className="auth-login-btn" onClick={onAuthClick}>Log in</button>
        )}
      </div>

      {/* Mobile hamburger */}
      <div className="top-controls--mobile" ref={menuRef}>
        <button
          className={'hamburger' + (menuOpen ? ' open' : '')}
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Menu"
        >
          <span /><span /><span />
        </button>

        {menuOpen && (
          <div className="mobile-menu">
            <div className="mobile-menu-row">
              <span className="mobile-menu-label">{lang === 'sv' ? 'Vy' : 'View'}</span>
              <div className="dim-toggle">
                {(['2d', '3d'] as const).map(dim => (
                  <button
                    key={dim}
                    className={'dim-btn' + (is3D === (dim === '3d') ? ' active' : '')}
                    onClick={() => { setIs3D(dim === '3d'); drawAll(); close() }}
                  >
                    {dim.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="mobile-menu-row">
              <span className="mobile-menu-label">{lang === 'sv' ? 'Språk' : 'Language'}</span>
              <div className="lang-toggle">
                {(['en', 'sv'] as const).map(l => (
                  <button
                    key={l}
                    className={'lang-btn' + (lang === l ? ' active' : '')}
                    onClick={() => { setLang(l); close() }}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="mobile-menu-divider" />
            {auth ? (
              <>
                <button className="mobile-menu-btn" onClick={() => { onDashboard(); close() }}>
                  {lang === 'sv' ? 'Sparade analyser' : 'Saved analyses'}
                </button>
                <button className="mobile-menu-btn mobile-menu-btn--danger" onClick={logout}>
                  Log out
                </button>
              </>
            ) : (
              <button className="mobile-menu-btn" onClick={() => { onAuthClick(); close() }}>
                Log in
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
