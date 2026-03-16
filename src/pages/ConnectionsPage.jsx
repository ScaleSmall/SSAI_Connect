import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { OAUTH_STATUS_URL, CONNECTOR_STATUS_URL, PLATFORM_ORDER, PLATFORM_META } from '../config';
import StatusBar from '../components/StatusBar';
import PlatformCard from '../components/PlatformCard';
import ConnectorCard from '../components/ConnectorCard';

export default function ConnectionsPage({ user, session }) {
  const [platforms, setPlatforms] = useState(null);
  const [connectors, setConnectors] = useState(null);
  const [error, setError] = useState(null);

  const fetchPlatforms = useCallback(async () => {
    if (!user?.n8n_client_id) return;
    try {
      const res = await fetch(`${OAUTH_STATUS_URL}?client_id=${user.n8n_client_id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPlatforms(data.platforms || []);
    } catch (err) {
      setError(`Failed to load platforms: ${err.message}`);
    }
  }, [user]);

  const fetchConnectors = useCallback(async () => {
    if (!user?.n8n_client_id) return;
    try {
      const res = await fetch(`${CONNECTOR_STATUS_URL}?client_id=${user.n8n_client_id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConnectors(data.my_connectors || []);
    } catch (err) {
      console.error('Failed to load connectors:', err);
      setConnectors([]);
    }
  }, [user]);

  useEffect(() => { fetchPlatforms(); fetchConnectors(); }, [fetchPlatforms, fetchConnectors]);

  // Handle OAuth return refresh
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('status') === 'success') {
      setTimeout(() => { fetchPlatforms(); fetchConnectors(); }, 500);
    }
  }, [fetchPlatforms, fetchConnectors]);

  const counts = useMemo(() => {
    if (!platforms) return { connected: 0, expired: 0, needsSetup: 0, disabled: 0 };
    let connected = 0, expired = 0, needsSetup = 0, disabled = 0;
    for (const p of platforms) {
      const meta = PLATFORM_META[p.platform];
      if (!meta || meta.hidden) continue;
      if (p.connected && !p.is_expired) connected++;
      else if (p.is_expired) expired++;
      else if (!p.enabled) disabled++;
      else needsSetup++;
    }
    return { connected, expired, needsSetup, disabled };
  }, [platforms]);

  const sortedPlatforms = useMemo(() => {
    if (!platforms) return [];
    return PLATFORM_ORDER
      .map(pid => platforms.find(p => p.platform === pid))
      .filter(p => p && PLATFORM_META[p.platform] && !PLATFORM_META[p.platform].hidden)
      .sort((a, b) => {
        const order = (p) => (!p.connected && !p.is_expired && p.enabled) ? 0 : p.is_expired ? 1 : !p.enabled ? 3 : 2;
        return order(a) - order(b);
      });
  }, [platforms]);

  if (!user?.n8n_client_id) {
    return (
      <div className="page-content">
        <h1>Connect Your Platforms</h1>
        <div className="error-box">No client ID linked to your account yet. Complete onboarding first.</div>
      </div>
    );
  }

  if (!platforms) {
    return (
      <div className="page-content">
        <h1>Connect Your Platforms</h1>
        {error ? <div className="error-box">{error}</div> : <div className="loading"><div className="spinner" />Loading platforms…</div>}
      </div>
    );
  }

  return (
    <div className="page-content">
      <h1>Connect Your Platforms</h1>
      <p className="subtitle">
        Connect each platform so <strong>Scale Small AI</strong> can
        create and publish content on behalf of <strong>{user.business_name}</strong>.
      </p>

      <StatusBar {...counts} />

      <div className="section-label">Platforms</div>
      <div className="platforms">
        {sortedPlatforms.map((p, i) => (
          <PlatformCard key={p.platform} platform={p} clientId={user.n8n_client_id} index={i} />
        ))}
      </div>

      {connectors && connectors.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: '2rem' }}>Photo Connectors</div>
          <p className="subtitle" style={{ marginBottom: '1rem' }}>
            Connect your photo source so we can automatically import job site photos.
          </p>
          <div className="platforms">
            {connectors.map((c) => (
              <ConnectorCard key={c.connector_type} connector={c} clientId={user.n8n_client_id} onRefresh={fetchConnectors} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
