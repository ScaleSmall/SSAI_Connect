import React, { useState } from 'react'

const ICON_STYLES = {
  facebook:  { background: '#1877f2', color: '#fff' },
  instagram: { background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', color: '#fff' },
  x:         { background: '#000', color: '#fff', border: '1px solid rgba(51,65,85,0.5)' },
  youtube:   { background: '#ff0000', color: '#fff' },
  linkedin:  { background: '#0a66c2', color: '#fff' },
  gbp:       { background: '#4285f4', color: '#fff' },
  tiktok:    { background: '#010101', color: '#fe2c55', border: '1px solid rgba(51,65,85,0.5)' },
}

const ICONS = {
  facebook: 'f', instagram: '📷', x: '𝕏', youtube: '▶',
  linkedin: 'in', gbp: 'G', tiktok: '♪',
}

export default function PlatformCard({ platform, data, clientId, delay = 0 }) {
  const [hovered, setHovered] = useState(false)
  const [btnHover, setBtnHover] = useState(false)

  const redir = encodeURIComponent(window.location.origin + window.location.pathname + '?client_id=' + clientId)
  const connectUrl = data.connect_url ? data.connect_url + '&redirect_after=' + redir : '#'
  const details = data.details || {}
  const info = Object.entries(details).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ')

  const isConnected = data.connected && !data.is_expired
  const isExpired = data.is_expired
  const isDisabled = !data.enabled

  let detail, detailColor, button
  if (isConnected) {
    const tl = timeLeft(data.token_expires_at)
    detail = info || tl || 'Connected'
    detailColor = 'var(--green)'
    button = <span style={{ ...btnBase, ...btnOk }}>✓ Connected</span>
  } else if (isExpired) {
    detail = 'Token expired — reconnect to fix'
    detailColor = 'var(--amber)'
    button = platform.noOAuth
      ? <span style={{ ...btnBase, ...btnReconnect }}>Reconnect Facebook</span>
      : <a href={connectUrl} style={{ ...btnBase, ...btnReconnect, ...(btnHover ? btnReconnectHover : {}) }}
            onMouseEnter={() => setBtnHover(true)} onMouseLeave={() => setBtnHover(false)}>
          ↻ Reconnect
        </a>
  } else if (isDisabled) {
    detail = 'Platform disabled'
    detailColor = 'var(--slate-500)'
    button = <span style={{ ...btnBase, ...btnDisabledStyle }}>Disabled</span>
  } else {
    detail = platform.note
    detailColor = 'var(--slate-500)'
    button = platform.noOAuth
      ? <span style={{ ...btnBase, ...btnDisabledStyle }}>Connect Facebook first</span>
      : <a href={connectUrl} style={{ ...btnBase, ...btnConnect, ...(btnHover ? btnConnectHover : {}) }}
            onMouseEnter={() => setBtnHover(true)} onMouseLeave={() => setBtnHover(false)}>
          Connect
        </a>
  }

  return (
    <div
      style={{
        ...cardStyle,
        ...(hovered ? cardHover : {}),
        animation: `fadeUp 0.45s ease both`,
        animationDelay: `${delay * 0.04}s`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ ...iconStyle, ...ICON_STYLES[platform.id] }}>
        {ICONS[platform.id]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={nameStyle}>{platform.name}</div>
        <div style={{ ...detailStyle, color: detailColor }}>{detail}</div>
      </div>
      {button}
    </div>
  )
}

function timeLeft(exp) {
  if (!exp) return ''
  const ms = new Date(exp).getTime() - Date.now()
  if (ms < 0) return 'expired'
  const d = Math.floor(ms / 86400000)
  const h = Math.floor(ms / 3600000)
  return d > 0 ? `${d}d remaining` : `${h}h remaining`
}

const cardStyle = {
  display: 'flex', alignItems: 'center', gap: 16,
  background: 'rgba(21,32,54,0.6)',
  borderRadius: 12, padding: '18px 24px',
  transition: 'background 0.2s',
}
const cardHover = { background: 'rgba(30,45,74,0.6)' }
const iconStyle = {
  width: 44, height: 44, borderRadius: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 18, fontWeight: 700, flexShrink: 0,
  fontFamily: "'Inter', sans-serif",
}
const nameStyle = { fontWeight: 600, fontSize: 15, color: 'var(--slate-50)' }
const detailStyle = { fontSize: 13, marginTop: 3 }

const btnBase = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '8px 20px', borderRadius: 9999,
  fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
  border: 'none', cursor: 'pointer', transition: 'all 0.2s',
  textDecoration: 'none', whiteSpace: 'nowrap',
}
const btnConnect = {
  background: 'var(--blue-accent)', color: 'var(--navy-900)',
  boxShadow: '0 0 15px rgba(96,165,250,0.4)',
}
const btnConnectHover = {
  boxShadow: '0 0 25px rgba(96,165,250,0.6)',
  transform: 'translateY(-1px)',
}
const btnReconnect = {
  background: 'transparent', color: 'var(--amber)',
  border: '1px solid rgba(245,158,11,0.4)',
}
const btnReconnectHover = { background: 'rgba(245,158,11,0.08)' }
const btnOk = {
  background: 'rgba(34,197,94,0.1)', color: 'var(--green)',
  border: '1px solid rgba(34,197,94,0.2)', cursor: 'default',
}
const btnDisabledStyle = {
  background: 'transparent', color: 'var(--slate-500)',
  border: '1px solid rgba(51,65,85,0.5)', cursor: 'not-allowed',
}
