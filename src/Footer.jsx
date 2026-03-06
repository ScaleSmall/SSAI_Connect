import React from 'react'

const linkStyle = {
  color: 'var(--slate-400)', textDecoration: 'none',
  transition: 'color 0.2s',
}

export default function Footer() {
  return (
    <footer style={{
      textAlign: 'center', padding: '40px 24px 32px',
      borderTop: '1px solid rgba(51,65,85,0.3)',
      maxWidth: 720, margin: '60px auto 0',
    }}>
      <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>
        © 2026{' '}
        <a href="https://scalesmall.ai" style={linkStyle}>SCALE SMALL.AI</a>
        {'  ·  '}
        <a href="https://scalesmall.ai/privacy/" style={linkStyle}>Privacy</a>
        {'  ·  '}
        <a href="https://scalesmall.ai/terms/" style={linkStyle}>Terms</a>
        {'  ·  '}
        <a href="https://scalesmall.ai/data-deletion/" style={linkStyle}>Data Deletion</a>
      </p>
    </footer>
  )
}
