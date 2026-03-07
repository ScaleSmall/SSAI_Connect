import React, { useState } from 'react'

const ICON_STYLES = {
  facebook: { background: '#1877f2', color: '#fff' },
  x:        { background: '#000', color: '#fff', border: '1px solid rgba(51,65,85,0.5)' },
  youtube:  { background: '#ff0000', color: '#fff' },
  linkedin: { background: '#0a66c2', color: '#fff' },
  gbp:      { background: '#4285f4', color: '#fff' },
  tiktok:   { background: '#010101', color: '#fe2c55', border: '1px solid rgba(51,65,85,0.5)' },
}

const ICONS = {
  facebook: 'f', x: '𝕏', youtube: '▶', linkedin: 'in', gbp: 'G', tiktok: '♪',
}

export default function CompletionScreen({ allSteps, completedIds, skippedPlatforms }) {
  const [dashHover, setDashHover] = useState(false)

  const connectedSteps = allSteps.filter(p => completedIds.has(p.id))
  const skippedSteps = allSteps.filter(p => skippedPlatforms.has(p.id))
  const hasSkipped = skippedSteps.length > 0
  const nothingSelected = allSteps.length === 0

  return (
    <div style={{ animation: 'fadeUp 0.5s ease both' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 44 }}>
        <div style={{
          width: 76, height: 76, borderRadius: '50%',
          margin: '0 auto 22px',
          background: hasSkipped
            ? 'rgba(245,158,11,0.1)'
            : 'rgba(34,197,94,0.1)',
          border: `2px solid ${hasSkipped ? 'rgba(245,158,11,0.35)' : 'rgba(34,197,94,0.35)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 34,
          boxShadow: `0 0 36px ${hasSkipped ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.18)'}`,
        }}>
          {hasSkipped ? '⚠' : '✓'}
        </div>

        <h1 style={{
          fontWeight: 800, fontSize: 30, color: 'var(--slate-50)',
          lineHeight: 1.2, marginBottom: 12,
        }}>
          {nothingSelected
            ? "You're All Set!"
            : hasSkipped
              ? 'Setup Partially Complete'
              : "You're Fully Connected!"}
        </h1>

        <p style={{
          fontSize: 16, color: 'var(--slate-400)', lineHeight: 1.65,
          maxWidth: 460, margin: '0 auto',
        }}>
          {nothingSelected
            ? 'No additional platform connections are required for your selected services.'
            : hasSkipped
              ? 'Some integrations were skipped. You can complete them at any time from your client dashboard.'
              : 'All your selected platforms are connected. Proof-of-Work is ready to publish on your behalf.'}
        </p>
      </div>

      {/* Connected platforms */}
      {connectedSteps.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={sectionLabel}>Connected</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {connectedSteps.map(p => (
              <div key={p.id} style={rowStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700,
                    fontFamily: "'Inter', sans-serif",
                    ...ICON_STYLES[p.id],
                  }}>
                    {ICONS[p.id]}
                  </div>
                  <span style={{ fontWeight: 500, fontSize: 15, color: 'var(--slate-200)' }}>
                    {p.name}
                  </span>
                </div>
                <span style={{
                  fontSize: 13, color: 'var(--green)', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  ✓ Connected
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skipped platforms */}
      {skippedSteps.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <div style={sectionLabel}>Skipped</div>
          <div style={{
            background: 'rgba(245,158,11,0.04)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 14,
            overflow: 'hidden',
          }}>
            {skippedSteps.map((p, i) => (
              <div key={p.id} style={{
                ...rowStyle,
                borderRadius: 0,
                background: 'transparent',
                borderBottom: i < skippedSteps.length - 1
                  ? '1px solid rgba(245,158,11,0.1)'
                  : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700, opacity: 0.55,
                    fontFamily: "'Inter', sans-serif",
                    ...ICON_STYLES[p.id],
                  }}>
                    {ICONS[p.id]}
                  </div>
                  <span style={{ fontWeight: 500, fontSize: 15, color: 'var(--slate-400)' }}>
                    {p.name}
                  </span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 500 }}>
                  Not connected
                </span>
              </div>
            ))}
          </div>
          <p style={{
            fontSize: 13, color: 'var(--slate-500)', marginTop: 10, lineHeight: 1.6,
          }}>
            ⚠ Skipped integrations limit what{' '}
            <strong style={{ color: 'var(--slate-400)' }}>Proof-of-Work</strong>{' '}
            can deliver for your account. Connect them from your dashboard whenever you're ready.
          </p>
        </div>
      )}

      {/* Dashboard CTA */}
      <div style={{
        background: 'rgba(21,32,54,0.7)',
        border: '1px solid rgba(96,165,250,0.15)',
        borderRadius: 18,
        padding: '28px 30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--slate-100)', marginBottom: 5 }}>
            Go to your client dashboard
          </div>
          <div style={{ fontSize: 14, color: 'var(--slate-400)' }}>
            Manage integrations, view reports, and track your service delivery.
          </div>
        </div>
        <a
          href="https://dashboard.scalesmall.ai"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '13px 26px',
            background: 'var(--blue-accent)',
            color: 'var(--navy-900)',
            borderRadius: 10, fontWeight: 700, fontSize: 14,
            textDecoration: 'none', whiteSpace: 'nowrap',
            boxShadow: dashHover
              ? '0 6px 28px rgba(96,165,250,0.5)'
              : '0 0 20px rgba(96,165,250,0.3)',
            transition: 'all 0.2s',
            transform: dashHover ? 'translateY(-1px)' : 'none',
          }}
          onMouseEnter={() => setDashHover(true)}
          onMouseLeave={() => setDashHover(false)}
        >
          Open Dashboard ↗
        </a>
      </div>
    </div>
  )
}

const sectionLabel = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: 1.8, color: 'var(--slate-500)',
  marginBottom: 10,
}

const rowStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 18px',
  background: 'rgba(21,32,54,0.5)',
  borderRadius: 10,
}
