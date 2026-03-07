import React, { useState, useEffect } from 'react'

export default function SkipModal({ platform, onConfirm, onCancel }) {
  const [checked, setChecked] = useState(false)
  const [cancelHover, setCancelHover] = useState(false)
  const [confirmHover, setConfirmHover] = useState(false)

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(10,18,33,0.88)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{
        background: 'var(--navy-800)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 20,
        padding: '36px 32px',
        maxWidth: 520,
        width: '100%',
        animation: 'fadeUp 0.25s ease',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(239,68,68,0.08)',
      }}>

        {/* Warning icon */}
        <div style={{
          width: 54, height: 54, borderRadius: '50%',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, marginBottom: 20,
        }}>
          ⚠
        </div>

        {/* Title */}
        <h2 style={{
          fontWeight: 700, fontSize: 20, color: 'var(--slate-50)',
          lineHeight: 1.3, marginBottom: 14,
        }}>
          Skip {platform.name} Integration?
        </h2>

        {/* Primary warning */}
        <p style={{
          fontSize: 14, color: 'var(--slate-300)', lineHeight: 1.75, marginBottom: 14,
        }}>
          By skipping this integration,{' '}
          <strong style={{ color: 'var(--slate-100)' }}>SCALE SMALL.AI</strong> will not be
          able to deliver the full scope of services you selected during onboarding.
          We are{' '}
          <strong style={{ color: 'var(--red)' }}>not responsible</strong> for any service
          limitations, omissions, or missed content resulting from your choice to skip
          this step.
        </p>

        {/* Dashboard note */}
        <p style={{
          fontSize: 14, color: 'var(--slate-400)', lineHeight: 1.75, marginBottom: 26,
        }}>
          You can set up this integration at any time from your{' '}
          <a
            href="https://dashboard.scalesmall.ai"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--blue-accent)', textDecoration: 'none', fontWeight: 600 }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
          >
            client dashboard
          </a>
          {' '}— a direct link was included in your setup email.
        </p>

        {/* Acknowledgment checkbox */}
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 13,
          padding: '14px 16px',
          background: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 10,
          cursor: 'pointer',
          marginBottom: 26,
          fontSize: 14,
          color: 'var(--slate-300)',
          lineHeight: 1.55,
          userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            style={{
              marginTop: 2, flexShrink: 0,
              width: 16, height: 16, cursor: 'pointer',
              accentColor: 'var(--red)',
            }}
          />
          I understand that skipping {platform.name} may limit my service delivery, and I
          elect to proceed without connecting this integration. I acknowledge that SCALE
          SMALL.AI bears no responsibility for any resulting service gaps.
        </label>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '13px 20px',
              background: cancelHover ? 'rgba(51,65,85,0.3)' : 'transparent',
              border: '1px solid rgba(51,65,85,0.6)',
              color: cancelHover ? 'var(--slate-50)' : 'var(--slate-300)',
              borderRadius: 10, fontWeight: 600, fontSize: 14,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
            onMouseEnter={() => setCancelHover(true)}
            onMouseLeave={() => setCancelHover(false)}
          >
            Cancel — I'll Connect It
          </button>

          <button
            onClick={checked ? onConfirm : undefined}
            disabled={!checked}
            style={{
              flex: 1, padding: '13px 20px',
              background: checked
                ? (confirmHover ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.15)')
                : 'rgba(51,65,85,0.25)',
              border: `1px solid ${checked ? 'rgba(239,68,68,0.45)' : 'rgba(51,65,85,0.3)'}`,
              color: checked ? 'var(--red)' : 'var(--slate-600)',
              borderRadius: 10, fontWeight: 600, fontSize: 14,
              cursor: checked ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
            onMouseEnter={() => { if (checked) setConfirmHover(true) }}
            onMouseLeave={() => setConfirmHover(false)}
          >
            Skip Anyway
          </button>
        </div>
      </div>
    </div>
  )
}
