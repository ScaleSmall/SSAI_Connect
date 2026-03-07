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

export default function WizardStep({
  platform, platformData, clientId,
  allSteps, completedIds, skippedPlatforms, onSkip,
}) {
  const [btnHover, setBtnHover] = useState(false)

  const redir = encodeURIComponent(
    window.location.origin + window.location.pathname + '?client_id=' + clientId
  )
  const connectUrl = platformData?.connect_url
    ? platformData.connect_url + '&redirect_after=' + redir
    : '#'

  const isExpired = platformData?.is_expired

  const currentIndex = allSteps.findIndex(p => p.id === platform.id)
  const totalSteps = allSteps.length
  const stepNumber = currentIndex + 1
  const completedCount = completedIds.size
  const progressPct = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0

  return (
    <div style={{ animation: 'fadeUp 0.4s ease both' }}>

      {/* Page header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--blue-accent)',
          textTransform: 'uppercase', letterSpacing: 1.8, marginBottom: 8,
        }}>
          Integration Setup
        </div>
        <h1 style={{
          fontWeight: 800, fontSize: 30, color: 'var(--slate-50)',
          lineHeight: 1.2, marginBottom: 10,
        }}>
          Connect Your Platforms
        </h1>
        <p style={{ fontSize: 15, color: 'var(--slate-400)', lineHeight: 1.6 }}>
          Complete each connection so{' '}
          <strong style={{ color: 'var(--blue-accent)', fontWeight: 600 }}>Proof-of-Work</strong>{' '}
          can publish your job photos automatically on your behalf.
        </p>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-300)' }}>
            Step {stepNumber} of {totalSteps}
          </span>
          <span style={{ fontSize: 13, color: 'var(--slate-500)' }}>
            {completedCount} of {totalSteps} connected
          </span>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 5, background: 'rgba(51,65,85,0.5)',
          borderRadius: 9999, overflow: 'hidden', marginBottom: 16,
        }}>
          <div style={{
            height: '100%',
            width: `${progressPct}%`,
            background: 'linear-gradient(to right, var(--blue-accent), var(--blue-glow))',
            borderRadius: 9999,
            transition: 'width 0.5s ease',
          }} />
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {allSteps.map((p) => {
            const isDone = completedIds.has(p.id)
            const isSkipped = skippedPlatforms.has(p.id)
            const isCurrent = p.id === platform.id

            let bg = 'rgba(51,65,85,0.5)'
            let fg = 'var(--slate-600)'
            let label = ''
            let shadow = {}

            if (isDone) {
              bg = 'var(--green)'; fg = '#fff'; label = '✓'
            } else if (isSkipped) {
              bg = 'rgba(245,158,11,0.25)'; fg = 'var(--amber)'; label = '–'
            } else if (isCurrent) {
              bg = 'var(--blue-accent)'; fg = 'var(--navy-900)'
              label = stepNumber
              shadow = { boxShadow: '0 0 12px rgba(96,165,250,0.5)' }
            }

            return (
              <div
                key={p.id}
                title={p.name}
                style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: bg, color: fg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  transition: 'all 0.3s',
                  flexShrink: 0,
                  ...shadow,
                }}
              >
                {label}
              </div>
            )
          })}
        </div>
      </div>

      {/* Platform card */}
      <div style={{
        background: 'rgba(21,32,54,0.7)',
        border: '1px solid rgba(96,165,250,0.15)',
        borderRadius: 20,
        padding: '36px 32px',
        boxShadow: '0 0 40px rgba(96,165,250,0.05)',
      }}>

        {/* Icon + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 700,
            fontFamily: "'Inter', sans-serif",
            ...ICON_STYLES[platform.id],
          }}>
            {ICONS[platform.id]}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--slate-50)' }}>
              {platform.name}
            </div>
            {isExpired && (
              <div style={{
                fontSize: 13, color: 'var(--amber)', marginTop: 5,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                ⚠ Token expired — reconnection required
              </div>
            )}
          </div>
        </div>

        {/* Purpose description */}
        <p style={{
          fontSize: 15, color: 'var(--slate-300)', lineHeight: 1.7, marginBottom: 30,
        }}>
          {platform.purpose}
        </p>

        {/* Connect button */}
        <a
          href={connectUrl}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '15px 24px',
            background: isExpired
              ? 'transparent'
              : 'linear-gradient(135deg, var(--blue-accent), #3b82f6)',
            border: isExpired ? '1px solid rgba(245,158,11,0.5)' : 'none',
            color: isExpired ? 'var(--amber)' : 'var(--navy-900)',
            borderRadius: 14,
            fontWeight: 700, fontSize: 16,
            textDecoration: 'none',
            fontFamily: 'inherit',
            transition: 'all 0.2s',
            boxShadow: isExpired ? 'none' : '0 4px 20px rgba(96,165,250,0.3)',
            cursor: 'pointer',
            ...(btnHover ? {
              transform: 'translateY(-1px)',
              boxShadow: isExpired
                ? '0 0 14px rgba(245,158,11,0.2)'
                : '0 6px 28px rgba(96,165,250,0.45)',
            } : {}),
          }}
          onMouseEnter={() => setBtnHover(true)}
          onMouseLeave={() => setBtnHover(false)}
        >
          {isExpired ? `↻ Reconnect ${platform.name}` : `Connect ${platform.name}`}
        </a>

        {/* Divider */}
        <div style={{ borderTop: '1px solid rgba(51,65,85,0.4)', margin: '24px 0' }} />

        {/* Skip link */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onSkip}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, color: 'var(--slate-500)',
              textDecoration: 'underline', textDecorationStyle: 'dotted',
              textUnderlineOffset: 3,
              transition: 'color 0.2s', padding: '4px 8px',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--slate-300)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--slate-500)'}
          >
            Skip this integration
          </button>
        </div>
      </div>
    </div>
  )
}
