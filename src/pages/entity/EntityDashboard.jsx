import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabase';
import { entityApi } from '../../lib/entity-api';

export default function EntityDashboard({ user, isAdmin }) {
  const [entities, setEntities] = useState([]);
  const [sel, setSel] = useState('');
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('entities').select('id,legal_name,brand_name,status,business_type')
      .eq('status', 'ACTIVE').order('legal_name')
      .then(({ data }) => { setEntities(data || []); if (data?.length) setSel(data[0].id); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!sel) return;
    entityApi.get(`/api/dashboard/${sel}`).then(r => setDash(r.data)).catch(() => {});
  }, [sel]);

  if (loading) return <div className="page-content"><div className="loading"><div className="spinner" />Loading...</div></div>;
  if (!entities.length) return (
    <div className="page-content">
      <h1>Local Entity Overview</h1>
      <div className="empty-state">
        <p>No entities yet.</p>
        {isAdmin && <Link to="/entity/onboarding" className="btn btn-connect" style={{ marginTop: 12 }}>Onboard First Entity</Link>}
      </div>
    </div>
  );

  return (
    <div className="page-content">
      <div className="page-head">
        <h1>Local Entity Overview</h1>
        {entities.length > 1 && (
          <select className="entity-select" value={sel} onChange={e => setSel(e.target.value)}>
            {entities.map(e => <option key={e.id} value={e.id}>{e.brand_name || e.legal_name}</option>)}
          </select>
        )}
      </div>

      {dash ? (
        <>
          <div className="stat-grid stat-grid-4">
            <div className="stat-card">
              <div className="stat-label">Presence Score</div>
              <div className="stat-value" style={{ color: dash.presence_score >= 70 ? 'var(--green)' : dash.presence_score >= 40 ? 'var(--amber)' : 'var(--red)' }}>
                {dash.presence_score ?? '—'}
              </div>
              <div className="stat-sub">out of 100</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Open Issues</div>
              <div className="stat-value">{dash.issues.total}</div>
              <div className="stat-sub">
                {dash.issues.critical > 0 && <span className="badge badge-red">{dash.issues.critical} critical</span>}
                {dash.issues.high > 0 && <span className="badge badge-amber" style={{ marginLeft: 4 }}>{dash.issues.high} high</span>}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Citations</div>
              <div className="stat-value">{dash.citations.total}</div>
              <div className="stat-sub">{dash.citations.correct} correct · {dash.citations.wrong} wrong</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Profiles</div>
              <div className="stat-value">{dash.profiles.total}</div>
              <div className="stat-sub">{dash.profiles.verified} verified</div>
            </div>
          </div>

          <div className="stat-grid stat-grid-3">
            <div className="e-card">
              <div className="e-card-head">
                <span className="e-card-title">Widget</span>
                {dash.widget && <span className={`badge ${dash.widget.status === 'ACTIVE' ? 'badge-ok' : 'badge-off'}`}>{dash.widget.status}</span>}
              </div>
              {dash.widget ? (
                <>
                  <div className="e-meta">Token: <code>{dash.widget.token}</code></div>
                  <div className="e-meta">Last seen: {dash.widget.last_seen ? new Date(dash.widget.last_seen).toLocaleString() : 'Never'}</div>
                </>
              ) : <div className="e-meta">Widget not installed</div>}
            </div>
            <div className="e-card">
              <div className="e-card-head"><span className="e-card-title">Last Scan</span></div>
              {dash.last_scan ? (
                <>
                  <span className={`badge ${dash.last_scan.status === 'SUCCEEDED' ? 'badge-ok' : 'badge-warn'}`}>{dash.last_scan.status}</span>
                  <div className="e-meta" style={{ marginTop: 6 }}>{dash.last_scan.type} · {dash.last_scan.finished_at ? new Date(dash.last_scan.finished_at).toLocaleString() : 'Running...'}</div>
                </>
              ) : (
                <>
                  <div className="e-meta">No scans yet</div>
                  {isAdmin && <Link to="/entity/scans" className="btn btn-connect btn-sm" style={{ marginTop: 8 }}>Run Scan</Link>}
                </>
              )}
            </div>
            <div className="e-card">
              <div className="e-card-head"><span className="e-card-title">Opportunities</span></div>
              <div className="stat-value" style={{ fontSize: 22 }}>{dash.opportunities}</div>
              <div className="e-meta">missing directories to claim</div>
            </div>
          </div>

          <div className="e-card">
            <div className="e-card-head">
              <span className="e-card-title">Citation Breakdown</span>
              <Link to="/entity/citations" className="btn btn-sm btn-reconnect">View All →</Link>
            </div>
            <div className="stat-grid stat-grid-4" style={{ marginTop: 12 }}>
              {['correct', 'variant', 'wrong', 'probable', 'possible', 'duplicate'].map(s => (
                <div key={s} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--slate-50)' }}>{dash.citations[s] || 0}</div>
                  <div className={`badge badge-${s === 'correct' ? 'ok' : s === 'wrong' ? 'red' : s === 'variant' ? 'amber' : 'off'}`} style={{ marginTop: 4 }}>{s}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : <div className="loading"><div className="spinner" />Loading dashboard...</div>}
    </div>
  );
}
