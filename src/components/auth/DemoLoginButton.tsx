'use client'

import { useState } from 'react'

export function DemoLoginButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDemo = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/demo', { method: 'POST' })
      if (!res.ok) throw new Error('Erreur')
      window.location.href = '/today'
    } catch {
      setError('Impossible de démarrer la démo. Réessayez.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-[#c9aa72]/40" />
        <span className="text-xs text-[#8a6b3e]">ou</span>
        <div className="flex-1 h-px bg-[#c9aa72]/40" />
      </div>

      <button
        onClick={handleDemo}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#c44a3a] to-[#b08948] px-4 py-3.5 text-sm font-semibold text-[#f3ecdd] shadow-lg hover:from-[#ab3326] hover:to-[#8a6a32] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Chargement…
          </>
        ) : (
          <>
            <span className="text-base">⚡</span>
            Essayer la démo — sans compte
          </>
        )}
      </button>

      {error && <p className="text-xs text-[#c44a3a] text-center">{error}</p>}

      <p className="text-xs text-[#8a6b3e] text-center">
        Données fictives préconfigurées · Aucune inscription requise
      </p>
    </div>
  )
}
