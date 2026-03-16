import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';

const ICONS = { GOOGLE:'🔍',BING:'🅱️',APPLE:'🍎',FACEBOOK:'📘',YELP:'⭐',LINKEDIN:'💼',INSTAGRAM:'📷',WEBSITE:'🌐',YOUTUBE:'▶️',NEXTDOOR:'🏘️',OTHER:'◎' };

export default function EntityProfiles({ user }) {
  const [profiles, setProfiles] = useState([]);
  const [entities, setEntities] = useState([]);
  const [sel, setSel] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('entities').select('id,legal_name,brand_name').eq('status','ACTIVE').order('legal_name')
      .then(({ data }) => { setEntities(data||[]); if (data?.length) setSel(data[0].id); });
  }, []);

  useEffect(() => {
    if (!sel) return; setLoading(true);
    supabase.from('entity_profiles').select('*').eq('entity_id',sel).order('authority_tier')
      .then(({ data }) => { setProfiles(data||[]); setLoading(false); });
  }, [sel]);

  return (
    <div className="page-content">
      <h1>Profiles</h1>
      <p className="subtitle">First-party platform presences your business controls</p>
      <div className="e-card" style={{marginBottom:16}}>
        <div className="form-group" style={{maxWidth:300,marginBottom:0}}><label>Entity</label>
          <select value={sel} onChange={e=>setSel(e.target.value)}>{entities.map(e=><option key={e.id} value={e.id}>{e.brand_name||e.legal_name}</option>)}</select>
        </div>
      </div>
      <div className="stat-grid stat-grid-3" style={{marginBottom:16}}>
        <div className="stat-card"><div className="stat-label">Total</div><div className="stat-value">{profiles.length}</div></div>
        <div className="stat-card"><div className="stat-label">Verified</div><div className="stat-value" style={{color:'var(--green)'}}>{profiles.filter(p=>p.verification_state==='VERIFIED').length}</div></div>
        <div className="stat-card"><div className="stat-label">Platforms</div><div className="stat-value">{new Set(profiles.map(p=>p.platform)).size}</div></div>
      </div>
      <div className="e-card">
        {loading ? <div className="loading"><div className="spinner"/>Loading...</div> : profiles.length===0 ? <div className="empty-state"><p>No profiles tracked yet.</p></div> : (
          <table className="e-table">
            <thead><tr><th>Platform</th><th>URL</th><th>Verification</th><th>Confidence</th><th>Tier</th></tr></thead>
            <tbody>
              {profiles.map(p => (
                <tr key={p.id}>
                  <td><span style={{marginRight:6}}>{ICONS[p.platform]||'◎'}</span><strong>{p.platform}</strong>{p.profile_handle&&<div className="e-meta">@{p.profile_handle}</div>}</td>
                  <td><a href={p.profile_url} target="_blank" rel="noopener noreferrer" className="link" style={{fontSize:12}}>{p.profile_url.length>45?p.profile_url.slice(0,45)+'...':p.profile_url}</a></td>
                  <td><span className={`badge ${p.verification_state==='VERIFIED'?'badge-ok':p.verification_state==='PROBABLE'?'badge-blue':'badge-off'}`}>{p.verification_state}</span></td>
                  <td className="mono">{p.confidence_score}</td>
                  <td><span className="badge badge-off">T{p.authority_tier}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
