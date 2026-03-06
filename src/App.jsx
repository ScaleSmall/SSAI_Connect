import React, { useState, useEffect } from 'react'
import Header from './Header'
import Footer from './Footer'
import PlatformCard from './PlatformCard'
import Toast from './Toast'

const SB = 'https://oyyfpkpzalhxztpcdjgq.supabase.co'

const PLATFORMS = [
  { id: 'facebook',  name: 'Facebook',       note: 'Page posting + connects Instagram' },
  { id: 'instagram', name: 'Instagram',       note: 'Connected through Facebook', noOAuth: true },
  { id: 'x',         name: 'X / Twitter',     note: 'Auto-refreshing 2-hour tokens' },
  { id: 'youtube',   name: 'YouTube',         note: 'YouTube Shorts from job photos' },
  { id: 'linkedin',  name: 'LinkedIn',        note: 'Company page posting' },
  { id: 'gbp',       name: 'Google Business', note: 'Local posts + photo gallery' },
  { id: 'tiktok',    name: 'TikTok',          note: 'Short-form video posting' },
]

const HIDDEN = ['reddit']

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const params = new URLSearchParams(window.location.search)
  const clientId = params.get('client_id') || params.get('c')

  useEffect(() => {
    // Show toast if returning from OAuth
    const status = params.get('status')
    const platform = params.get('platform')
    if (status === 'success' && platform) {
      setToast(`✓ ${platform.charAt(0).toUpperCase() + platform.slice(1)} connected successfully`)
      // Clean URL
      const url = new URL(window.location)
      ;['status', 'platform', 'warnings'].forEach(k => url.searchParams.delete(k))
      window.history.replaceState({}, '', url)
    }
  }, [])

  useEffect(() => {
    if (!clientId) return
    fetch(`${SB}/functions/v1/oauth-status?client_id=${clientId}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }, [clientId])

  // Count statuses
  const counts = { ok: 0, warn: 0, need: 0, off: 0 }
  if (data) {
    for (const p of data.platforms || []) {
      if (HIDDEN.includes(p.platform)) continue
      if (p.connected && !p.is_expired) counts.ok++
      else if (p.is_expired) counts.warn++
      else if (!p.enabled) counts.off++
      else counts.need++
    }
  }

  return (
    <>
      <Header />
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '120px 24px 80px' }}>

        {/* No client_id */}
        {!clientId && (
          <>
            <h1 style={h1Style}>Connect Your Platforms</h1>
            <div style={errorBox}>
              No client ID provided. Add <code style={codeSt}>?client_id=your-id</code> to the URL.
            </div>
          </>
        )}

        {/* Loading */}
        {clientId && !data && !error && (
          <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--slate-400)' }}>
            <div style={spinnerStyle} />
            Loading platform status…
          </div>
        )}

        {/* Error */}
        {clientId && error && (
          <>
            <h1 style={h1Style}>Connect Your Platforms</h1>
            <div style={errorBox}>Failed to load platform status: {error}</div>
          </>
        )}

        {/* Data loaded */}
        {data && (
          <>
            <h1 style={h1Style}>Connect Your Platforms</h1>
            <p style={subtitleStyle}>
              Authorize each social platform so{' '}
              <strong style={{ color: 'var(--blue-accent)', fontWeight: 600 }}>Proof-of-Work</strong>{' '}
              can publish job photos automatically on your behalf.
            </p>

            {/* Status bar */}
            <div style={statusBar}>
              <Stat color="var(--green)" glow label={`${counts.ok} connected`} />
              {counts.warn > 0 && <Stat color="var(--amber)" glow label={`${counts.warn} expired`} />}
              {counts.need > 0 && <Stat color="var(--red)" label={`${counts.need} needs setup`} />}
              {counts.off > 0 && <Stat color="var(--slate-700)" label={`${counts.off} disabled`} />}
            </div>

            {/* Section label */}
            <div style={sectionLabel}>Platforms</div>

            {/* Platform cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PLATFORMS.map((platform, i) => {
                const pData = (data.platforms || []).find(p => p.platform === platform.id)
                if (!pData || HIDDEN.includes(platform.id)) return null
                return (
                  <PlatformCard
                    key={platform.id}
                    platform={platform}
                    data={pData}
                    clientId={clientId}
                    delay={i + 1}
                  />
                )
              })}
            </div>
          </>
        )}
      </main>

      <Footer />

      {toast && <Toast message={toast} />}
    </>
  )
}

function Stat({ color, glow, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 500 }}>
      <span style={{
        width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
        background: color,
        ...(glow ? { boxShadow: `0 0 8px ${color}` } : {}),
      }} />
      {label}
    </div>
  )
}

const h1Style = {
  fontWeight: 800, fontSize: 32, color: 'var(--slate-50)',
  lineHeight: 1.2, marginBottom: 8,
}

const subtitleStyle = {
  fontSize: 16, color: 'var(--slate-300)',
  lineHeight: 1.6, marginBottom: 32,
}

const statusBar = {
  display: 'flex', gap: 20, flexWrap: 'wrap',
  padding: '16px 24px',
  background: 'rgba(21,32,54,0.6)',
  borderRadius: 12,
  marginBottom: 36,
}

const sectionLabel = {
  fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: 1.5, color: 'var(--slate-500)',
  marginBottom: 12,
}

const errorBox = {
  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
  borderRadius: 12, padding: '20px 24px', color: 'var(--red)',
  fontSize: 14, marginTop: 24,
}

const codeSt = {
  background: 'rgba(239,68,68,0.1)', padding: '2px 6px',
  borderRadius: 4, fontSize: 13,
}

const spinnerStyle = {
  width: 32, height: 32,
  border: '3px solid rgba(51,65,85,0.5)',
  borderTopColor: 'var(--blue-accent)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
  margin: '0 auto 14px',
}
