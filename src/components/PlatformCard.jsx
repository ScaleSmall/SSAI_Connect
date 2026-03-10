import React from 'react';
import { PLATFORM_META } from '../config';

function timeStr(exp) {
  if (!exp) return '';
  const ms = new Date(exp).getTime() - Date.now();
  if (ms < 0) return 'expired';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000);
  return d > 0 ? `${d}d remaining` : `${h}h remaining`;
}

export default function PlatformCard({ platform, clientId, index }) {
  const meta = PLATFORM_META[platform.platform];
  if (!meta || meta.hidden) return null;

  const redirectUrl = encodeURIComponent(
    window.location.origin + window.location.pathname
  );
  const connectUrl = platform.connect_url
    ? platform.connect_url + '&redirect_after=' + redirectUrl
    : '#';

  const details = platform.details || {};
  const detailStr = Object.entries(details)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');

  let detail, detailClass, button;

  if (platform.connected && !platform.is_expired) {
    detail = detailStr || timeStr(platform.token_expires_at) || 'Connected';
    detailClass = 'ok';
    button = <span className="btn btn-ok">✓ Connected</span>;
  } else if (platform.is_expired) {
    detail = 'Token expired — reconnect to fix';
    detailClass = 'warn';
    button = meta.noOAuth
      ? <span className="btn btn-reconnect">Reconnect Facebook</span>
      : <a href={connectUrl} className="btn btn-reconnect">↻ Reconnect</a>;
  } else if (!platform.enabled) {
    detail = 'Platform disabled';
    detailClass = 'off';
    button = <span className="btn btn-disabled">Disabled</span>;
  } else {
    detail = meta.note;
    detailClass = 'off';
    if (meta.noOAuth) {
      const label = meta.derived ? 'Connect Facebook first'
        : 'Manual setup required';
      button = <span className="btn btn-disabled">{label}</span>;
    } else {
      button = <a href={connectUrl} className="btn btn-connect">Connect</a>;
    }
  }

  return (
    <div className="p-card" style={{ animation: `fadeUp 0.45s ease ${index * 0.04}s both` }}>
      <div className={`p-icon ${meta.iconClass}`}>{meta.icon}</div>
      <div className="p-info">
        <div className="p-name">{meta.name}</div>
        <div className={`p-detail ${detailClass}`}>{detail}</div>
      </div>
      {button}
    </div>
  );
}
