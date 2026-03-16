import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';

export default function EntityAlerts({ user }) {
  const [alerts, setAlerts] = useState([]);
  const [entities, setEntities] = useState([]);
  const [sel, setSel] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('entities').select('id,legal_name,brand_name').eq('status','ACTIVE').order('legal_name')
      .then(({ data }) => { setEntities(data||[]); if (data?.length) setSel(data[0].id); });
  }, []);

  useEffect(() => {
    if (!sel) return; setLoading(true);
    supabase.from('alerts').select('*').eq('entity_id',sel).order('created_at',{ascending:false}).limit(50)
      .then(({ data }) => { setAlerts(data||[]); setLoading(false); });
  }, [sel]);

  return (
    <div className="page-content">
      <h1>Alerts</h1>
      <p className="subtitle">Notification history and delivery status</p>
      <div className="e-card" style={{marginBottom:16}}>
        <div className="form-group" style={{maxWidth:300,marginBottom:0}}><label>Entity</label>
          <select value={sel} onChange={e=>setSel(e.target.value)}>{entities.map(e=><option key={e.id} value={e.id}>{e.brand_name||e.legal_name}</option>)}</select>
        </div>
      </div>
      <div className="stat-grid stat-grid-4" style={{marginBottom:16}}>
        <div className="stat-card"><div className="stat-label">Total</div><div className="stat-value">{alerts.length}</div></div>
        <div className="stat-card"><div className="stat-label">Sent</div><div className="stat-value" style={{color:'var(--green)'}}>{alerts.filter(a=>a.status==='SENT').length}</div></div>
        <div className="stat-card"><div className="stat-label">Acknowledged</div><div className="stat-value" style={{color:'var(--blue-accent)'}}>{alerts.filter(a=>a.status==='ACKNOWLEDGED').length}</div></div>
        <div className="stat-card"><div className="stat-label">Queued</div><div className="stat-value">{alerts.filter(a=>a.status==='QUEUED').length}</div></div>
      </div>
      <div className="e-card">
        {loading ? <div className="loading"><div className="spinner"/>Loading...</div> : alerts.length===0 ? <div className="empty-state"><p>No alerts yet.</p></div> : (
          <table className="e-table">
            <thead><tr><th>Subject</th><th>Type</th><th>Severity</th><th>Status</th><th>Created</th><th>Sent</th></tr></thead>
            <tbody>
              {alerts.map(a => (
                <tr key={a.id}>
                  <td style={{fontWeight:500}}>{a.subject}</td>
                  <td style={{fontSize:12}}>{a.alert_type}</td>
                  <td><span className={`badge badge-${a.severity==='CRITICAL'?'red':a.severity==='HIGH'?'amber':'off'}`}>{a.severity}</span></td>
                  <td><span className={`badge ${a.status==='SENT'?'badge-ok':a.status==='FAILED'?'badge-red':a.status==='ACKNOWLEDGED'?'badge-blue':'badge-off'}`}>{a.status}</span></td>
                  <td className="e-meta">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="e-meta">{a.sent_at?new Date(a.sent_at).toLocaleString():'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
