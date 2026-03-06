import React from 'react'

const styles = {
  header: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    background: 'rgba(10,18,33,0.95)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
  inner: {
    maxWidth: 1280, margin: '0 auto',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px', height: 72,
  },
  logoGroup: {
    display: 'flex', alignItems: 'center', gap: 12,
    textDecoration: 'none',
  },
  logoImg: { width: 48, height: 48, borderRadius: '50%' },
  logoText: { display: 'flex', flexDirection: 'column' },
  logoBrand: { display: 'flex', alignItems: 'baseline', gap: 4 },
  w1: {
    fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
    fontSize: 18, color: 'var(--slate-50)', letterSpacing: '-0.01em',
  },
  w2: {
    fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
    fontSize: 18,
    background: 'linear-gradient(to right, var(--blue-accent), var(--blue-glow))',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  tagline: {
    fontSize: 11, fontStyle: 'italic', color: 'var(--slate-50)',
    marginTop: 1, fontWeight: 500,
  },
  link: {
    fontSize: 14, fontWeight: 600, color: 'var(--slate-300)',
    textDecoration: 'none', transition: 'color 0.2s',
  },
}

export default function Header() {
  return (
    <header style={styles.header}>
      <div style={styles.inner}>
        <a style={styles.logoGroup} href="https://scalesmall.ai">
          <img style={styles.logoImg} src="https://scalesmall.ai/logo.png" alt="SCALE SMALL.AI logo" />
          <div style={styles.logoText}>
            <div style={styles.logoBrand}>
              <span style={styles.w1}>SCALE</span>
              <span style={styles.w2}>SMALL.AI</span>
            </div>
            <span style={styles.tagline}>Small Business Focused</span>
          </div>
        </a>
        <a
          style={styles.link}
          href="https://scalesmall.ai/products/proof-of-work/"
          onMouseEnter={e => e.target.style.color = 'var(--blue-glow)'}
          onMouseLeave={e => e.target.style.color = 'var(--slate-300)'}
        >
          Proof-of-Work ↗
        </a>
      </div>
    </header>
  )
}
