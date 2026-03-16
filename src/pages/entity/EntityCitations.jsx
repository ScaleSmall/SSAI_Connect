import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';

const SB = { correct:'badge-ok', variant:'badge-amber', wrong:'badge-red', probable:'badge-blue', possible:'badge-off', duplicate:'badge-amber', NOT_US:'badge-off' };

export default function EntityCitations({ user }) {
  const [citations, setCitations] = useState([]);
  const [entities, setEntities] = useState([]);
  const [sel, setSel] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('entities').select('id,legal_name,brand_name').eq('status','ACTIVE').order('legal_name')
      .then(({ data }) => { setEntities(data||[]); if (data?.length) setSel(data[0].id); });
  }, []);

  useEffect(() => {
    if (!sel) return;
    setLoading(true);
    let q = supabase.from('entity_citations').select('*').eq('entity_id', sel).order('match_score', { ascending: false });
    if (statusFilter) q = q.eq('status', statusFilter);
    q.then(({ data }) => { setCitations(data||[]); setLoading(false); });
  }, [sel, statusFilter]);

  const stats = { total: citations.length, correct: citations.filter(c=>c.status==='CORRECT').length, wrong: citations.filter(c=>c.status==='WRONG').length, variant: citations.filter(c=>c.status==='VARIANT').length };

  return (
    <div className="page-content">
      <h1>Citations</h1>
      <p className="subtitle">Third-party mentions of your business across the web</p>
      <div className="e-card" style={{ marginBottom: 16 }}>
        <div style={{ display:'flex', gap:12, alignItems:'end', flexWrap:'wrap' }}>
          <div className="form-group" style={{ flex:1, minWidth:200, marginBottom:0 }}>
            <label>Entity</label>
            <select value={sel} onChange={e=>setSel(e.target.value)}>
              {entities.map(e=><option key={e.id} value={e.id}>{e.brand_name||e.legal_name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth:140, marginBottom:0 }}>
            <label>Status</label>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
              <option value="">All</option>
              {['CORRECT','VARIANT','WRONG','PROBABLE','POSSIBLE','DUPLICATE','NOT_US'].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="stat-grid stat-grid-4" style={{ marginBottom:16 }}>
        <div className="stat-card"><div className="stat-label">Total</div><div className="stat-value">{stats.total}</div></div>
        <div className="stat-card"><div className="stat-label">Correct</div><div className="stat-value" style={{color:'var(--green)'}}>{stats.correct}</div></div>
        <div className="stat-card"><div className="stat-label">Wrong</div><div className="stat-value" style={{color:'var(--red)'}}>{stats.wrong}</div></div>
        <div className="stat-card"><div className="stat-label">Variants</div><div className="stat-value" style={{color:'var(--amber)'}}>{stats.variant}</div></div>
      </div>
      <div className="e-card">
        {loading ? <div className="loading"><div className="spinner"/>Loading...</div> : citations.length===0 ? <div className="empty-state"><p>No citations. Run a scan to discover them.</p></div> : (
          <table className="e-table">
            <thead><tr><th>Domain</th><th>Name</th><th>Status</th><th>Score</th><th>Tier</th><th>Last Seen</th></tr></thead>
            <tbody>
              {citations.map(c => (
                <tr key={c.id}>
                  <td><a href={c.url} target="_blank" rel="noopener noreferrer" className="link">{c.root_domain}</a><div className="e-meta" style={{maxWidth:250,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.title||c.url}</div></td>
                  <td>{c.extracted_name||'—'}</td>
                  <td><span className={`badge ${SB[c.status.toLowerCase()]||'badge-off'}`}>{c.status}</span></td>
                  <td className="mono">{c.match_score}</td>
                  <td><span className={`badge ${c.authority_tier<=1?'badge-red':c.authority_tier<=2?'badge-amber':'badge-off'}`}>T{c.authority_tier}</span></td>
                  <td className="e-meta">{c.last_seen_at?new Date(c.last_seen_at).toLocaleDateString():'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
