import React, { useEffect, useState } from 'react';
import { oauthRelayChannelName, parseOAuthCompletion } from './oauthFlow';

export default function OAuthCompletePage() {
  const [platform, setPlatform] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const completion = parseOAuthCompletion(window.location.search, window.location.origin);
    const requestId = completion?.requestId || '';

    setPlatform(completion?.platform || '');
    if (!completion || completion.failed) {
      setErrorMsg('Connection could not be completed. Please try again.');
    }

    if (completion && requestId && typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel(oauthRelayChannelName(requestId));
        channel.postMessage(completion.message);
        channel.close();
      } catch {
        console.warn('[OAuthCompletePage] OAuth completion relay was unavailable');
      }
    }

    const timer = setTimeout(() => {
      window.close();
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  const label = platform
    ? platform.charAt(0).toUpperCase() + platform.slice(1).replace(/_/g, ' ')
    : 'Platform';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#0f172a',
      color: '#f1f5f9',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: 32,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{errorMsg ? '!' : '✓'}</div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: errorMsg ? '#fca5a5' : '#4ade80' }}>
        {errorMsg ? 'Connection failed' : `${label} connected`}
      </h1>
      <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 8 }}>
        {errorMsg ? `Could not connect ${label}.` : 'Returning to Connect...'}
      </p>
      {errorMsg && (
        <p style={{ color: '#64748b', fontSize: 12, marginBottom: 24, maxWidth: 320 }}>
          {errorMsg}
        </p>
      )}
      <button
        type="button"
        onClick={() => window.close()}
        style={{
          padding: '8px 20px',
          background: '#1e40af',
          color: '#f1f5f9',
          border: '1px solid #3b82f6',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        Close window
      </button>
    </div>
  );
}
