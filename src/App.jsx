import React, { useState, useEffect, useCallback } from 'react'
import Header from './Header'
import Footer from './Footer'
import Toast from './Toast'
import WizardStep from './WizardStep'
import SkipModal from './SkipModal'
import CompletionScreen from './CompletionScreen'

const SB = 'https://oyyfpkpzalhxztpcdjgq.supabase.co'

export const PLATFORMS = [
  {
    id: 'facebook',
    name: 'Facebook',
    note: 'Page posting + connects Instagram',
    purpose: 'Post job photos and project updates to your Facebook Business Page — and automatically link your Instagram account for simultaneous posting.',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    note: 'Connected through Facebook',
    purpose: 'Share job photos as Instagram posts and reels via your connected Facebook account.',
    noOAuth: true,
  },
  {
    id: 'x',
    name: 'X / Twitter',
    note: 'Auto-refreshing 2-hour tokens',
    purpose: 'Automatically share project highlights and job updates to your X (Twitter) profile to grow your audience.',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    note: 'YouTube Shorts from job photos',
    purpose: "Turn your job photos into YouTube Shorts to grow your brand on the world's largest video platform.",
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    note: 'Company page posting',
    purpose: 'Publish professional job updates to your LinkedIn Company Page to attract commercial and B2B clients.',
  },
  {
    id: 'gbp',
    name: 'Google Business',
    note: 'Local posts + photo gallery',
    purpose: 'Post directly to your Google Business Profile to improve local search rankings and attract nearby customers.',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    note: 'Short-form video posting',
    purpose: "Create and publish short-form videos from your job photos to reach TikTok's massive and growing audience.",
  },
]

const HIDDEN = ['reddit']

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [skipTarget, setSkipTarget] = useState(null)

  const params = new URLSearchParams(window.location.search)
  const clientId = params.get('client_id') || params.get('c')

  const skippedKey = clientId ? `ssai_skipped_${clientId}` : null

  const loadSkipped = () => {
    if (!skippedKey) return new Set()
    try { return new Set(JSON.parse(localStorage.getItem(skippedKey) || '[]')) }
    catch { return new Set() }
  }

  const [skippedPlatforms, setSkippedPlatforms] = useState(loadSkipped)

  const fetchData = useCallback(() => {
    if (!clientId) return
    fetch(`${SB}/functions/v1/oauth-status?client_id=${clientId}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }, [clientId])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const status = params.get('status')
    const platform = params.get('platform')
    if (status === 'success' && platform) {
      setToast(`✓ ${platform.charAt(0).toUpperCase() + platform.slice(1)} connected successfully`)
      const url = new URL(window.location)
      ;['status', 'platform', 'warnings'].forEach(k => url.searchParams.delete(k))
      window.history.replaceState({}, '', url)
      fetchData()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Wizard steps: only enabled platforms that support direct OAuth
  const allSteps = PLATFORMS.filter(p => {
    if (HIDDEN.includes(p.id) || p.noOAuth) return false
    const pData = (data?.platforms || []).find(d => d.platform === p.id)
    return pData?.enabled === true
  })

  // Already connected (not expired) — skip these in wizard
  const completedIds = new Set(
    allSteps
      .filter(p => {
        const pData = (data?.platforms || []).find(d => d.platform === p.id)
        return pData?.connected && !pData?.is_expired
      })
      .map(p => p.id)
  )

  // Pending = not completed and not deliberately skipped
  const pendingSteps = allSteps.filter(
    p => !completedIds.has(p.id) && !skippedPlatforms.has(p.id)
  )

  const currentPlatform = pendingSteps[0] || null
  const currentPlatformData = currentPlatform
    ? (data?.platforms || []).find(d => d.platform === currentPlatform.id)
    : null

  const isComplete = !!data && allSteps.length > 0 && pendingSteps.length === 0
  const hasNoSteps = !!data && allSteps.length === 0

  const handleSkipConfirm = () => {
    if (!skipTarget) return
    const next = new Set(skippedPlatforms)
    next.add(skipTarget.id)
    setSkippedPlatforms(next)
    if (skippedKey) localStorage.setItem(skippedKey, JSON.stringify([...next]))
    setSkipTarget(null)
  }

  return (
    <>
      <Header />
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '120px 24px 80px' }}>

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
            Loading your setup…
          </div>
        )}

        {/* Error */}
        {clientId && error && (
          <>
            <h1 style={h1Style}>Connect Your Platforms</h1>
            <div style={errorBox}>Failed to load your setup: {error}</div>
          </>
        )}

        {/* No selected platforms or all done */}
        {(isComplete || hasNoSteps) && (
          <CompletionScreen
            allSteps={allSteps}
            completedIds={completedIds}
            skippedPlatforms={skippedPlatforms}
          />
        )}

        {/* Wizard in progress */}
        {data && !isComplete && !hasNoSteps && currentPlatform && (
          <WizardStep
            platform={currentPlatform}
            platformData={currentPlatformData}
            clientId={clientId}
            allSteps={allSteps}
            completedIds={completedIds}
            skippedPlatforms={skippedPlatforms}
            onSkip={() => setSkipTarget(currentPlatform)}
          />
        )}

      </main>

      <Footer />

      {skipTarget && (
        <SkipModal
          platform={skipTarget}
          onConfirm={handleSkipConfirm}
          onCancel={() => setSkipTarget(null)}
        />
      )}

      {toast && <Toast message={toast} />}
    </>
  )
}

const h1Style = {
  fontWeight: 800, fontSize: 32, color: 'var(--slate-50)',
  lineHeight: 1.2, marginBottom: 8,
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
