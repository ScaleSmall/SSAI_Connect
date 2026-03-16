import React, { useState } from 'react';

const CONNECTOR_ICONS = {
  companycam: '📸',
  google_drive: '📁',
  dropbox: '💧',
  jobber: '🔧',
  manual_upload: '⬆️',
};

export default function ConnectorCard({ connector, clientId, onRefresh }) {
  const [apiToken, setApiToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const SUPABASE_URL = 'https://oyyfpkpzalhxztpcdjgq.supabase.co';
  const endpoint = `${SUPABASE_URL}/functions/v1/connect-connector`;

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = { connector_type: connector.connector_type, client_id: clientId };
      if (connector.auth_type === 'api_key') {
        if (!apiToken.trim()) { setError('Please enter your API token'); setLoading(false); return; }
        body.api_token = apiToken.trim();
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Connection failed');
      setApiToken('');
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connector_type: connector.connector_type, client_id: clientId, action: 'disconnect' }),
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const icon = CONNECTOR_ICONS[connector.connector_type] || '🔌';
  const isConnected = connector.status === 'connected';
  const needsSetup = connector.status === 'setup_required';

  return (
    <div className={`card ${isConnected ? 'card-connected' : needsSetup ? 'card-action' : 'card-disconnected'}`}>
      <div className="card-header">
        <span className="card-icon">{icon}</span>
        <div className="card-title">
          <h3>{connector.display_name}</h3>
          <p className="card-desc">{connector.description}</p>
        </div>
        <span className={`badge ${isConnected ? 'badge-ok' : needsSetup ? 'badge-warn' : 'badge-off'}`}>
          {isConnected ? 'Connected' : needsSetup ? 'Setup Required' : 'Disconnected'}
        </span>
      </div>

      {isConnected && (
        <div className="card-body">
          {connector.photos_imported > 0 && (
            <p className="card-stat">{connector.photos_imported} photos imported</p>
          )}
          {connector.last_polled_at && (
            <p className="card-stat">Last synced: {new Date(connector.last_polled_at).toLocaleString()}</p>
          )}
          <button className="btn btn-sm btn-disconnect" onClick={handleDisconnect} disabled={loading}>
            {loading ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      )}

      {needsSetup && connector.auth_type === 'api_key' && (
        <div className="card-body">
          {connector.setup_instructions?.steps && (
            <ol className="setup-steps">
              {connector.setup_instructions.steps.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
          )}
          <div className="token-input-row">
            <input
              type="password"
              placeholder="Paste your API token"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              className="input-token"
            />
            <button className="btn btn-connect" onClick={handleConnect} disabled={loading}>
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
          {error && <p className="card-error">{error}</p>}
        </div>
      )}

      {needsSetup && connector.auth_type === 'none' && (
        <div className="card-body">
          <button className="btn btn-connect" onClick={handleConnect} disabled={loading}>
            {loading ? 'Enabling...' : 'Enable'}
          </button>
        </div>
      )}
    </div>
  );
}
