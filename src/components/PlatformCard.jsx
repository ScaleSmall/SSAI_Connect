import React, { useState } from 'react';
import { PLATFORM_META } from '../config';
import PlatformIcon from './PlatformIcon';
import { SUPABASE_URL } from '../supabase';

function timeStr(exp) {
  if (!exp) return '';
  const ms = new Date(exp).getTime() - Date.now();
  if (ms < 0) return 'expired';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000);
  return d > 0 ? `${d}d remaining` : `${h}h remaining`;
}

function WebsiteEmbed({ clientId }) {
  const [copied, setCopied] = useState(false);
  const embedCode = `<script src="${SUPABASE_URL}/functions/v1/widget-gallery?format=js" data-client="${clientId}"><\/script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="embed-section">
      <p className="embed-label">Paste this on your website where you want the gallery:</p>
      <div className="embed-code-row">
        <code className="embed-code">{embedCode}</code>
        <button className={`btn ${copied ? 'btn-ok' : 'btn-connect'} btn-sm`} onClick={handleCopy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <p className="embed-hint">
        Works on WordPress, Squarespace, Wix, or any HTML page. Optional attributes:
        <code>data-limit="12"</code> <code>data-columns="3"</code> <code>data-theme="dark"</code>
      </p>
    </div>
  );
}

export default function PlatformCard({ platform, clientId, index }) {
  const [showEmbed, setShowEmbed] = useState(false);
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

  const isWebsite = platform.platform === 'website';

  let detail, detailClass, button;

  if (platform.connected && !platform.is_expired) {
    if (isWebsite) {
      const domain = details.domain || 'your site';
      detail = `Widget active on ${domain}`;
      detailClass = 'ok';
      button = <button className="btn btn-ok" onClick={() => setShowEmbed(!showEmbed)}>{showEmbed ? '▾ Hide Code' : '✓ Connected'}</button>;
    } else {
      detail = detailStr || timeStr(platform.token_expires_at) || 'Connected';
      detailClass = 'ok';
      button = <span className="btn btn-ok">✓ Connected</span>;
    }
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
    if (isWebsite) {
      detail = 'Paste embed code on your site to connect';
      detailClass = 'err';
      button = <button className="btn btn-connect" onClick={() => setShowEmbed(!showEmbed)}>{showEmbed ? '▾ Hide' : 'Get Embed Code'}</button>;
    } else if (meta.noOAuth) {
      detailClass = meta.derived ? 'off' : 'err';
      const label = meta.derived ? 'Connect Facebook first' : 'Setup required';
      button = <span className="btn btn-disabled">{label}</span>;
    } else {
      detailClass = 'err';
      button = <a href={connectUrl} className="btn btn-connect">Connect</a>;
    }
  }

  return (
    <div className="p-card-wrapper" style={{ animation: `fadeUp 0.45s ease ${index * 0.04}s both` }}>
      <div className="p-card">
        <div className={`p-icon ${meta.iconClass}`}>
          <PlatformIcon platform={platform.platform} />
        </div>
        <div className="p-info">
          <div className="p-name">{meta.name}</div>
          <div className={`p-detail ${detailClass}`}>{detail}</div>
        </div>
        {button}
      </div>
      {isWebsite && showEmbed && <WebsiteEmbed clientId={clientId} />}
    </div>
  );
}
