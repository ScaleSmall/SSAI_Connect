import React, { useEffect, useState } from 'react'

export default function Toast({ message, duration = 4000 }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), duration)
    return () => clearTimeout(timer)
  }, [duration])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--green)', color: '#fff',
      padding: '12px 28px', borderRadius: 9999,
      fontWeight: 600, fontSize: 14,
      boxShadow: '0 0 20px rgba(34,197,94,0.4), 0 8px 32px rgba(0,0,0,0.4)',
      animation: 'toastIn 0.35s ease', zIndex: 200,
    }}>
      {message}
    </div>
  )
}
