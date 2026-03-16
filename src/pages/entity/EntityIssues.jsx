import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { entityApi } from '../../lib/entity-api';

export default function EntityIssues({ user, isAdmin }) {
  const [issues, setIssues] = useState([]);
  const [entities, setEntities] = useState([]);
  const [sel, setSel] = useState('');
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);

  useEffect(() => {
    supabase.from('entities').select('id,legal_name,brand_name').eq('status','ACTIVE').order('legal_name')
      .then(({ data }) => { setEntities(data||[]); if (data?.length) setSel(data[0].id); });
  }, []);

  useEffect(() => { if (sel) loadIssues(); }, [sel, statusFilter]);

  async function loadIssues() {
    setLoading(true);
    let q = supabase.from('entity_issues').select('*').eq('entity_id',sel).order('severity').order('created_at',{ascending:false});
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data } = await q;
    setIssues(data||[]); setLoading(false);
  }

  async function genPacket(id) {
    setGenerating(id);
    try { await entityApi.post('/api/instruction-packets/generate', { issue_id: id, entity_id: sel }); alert('Instruction packet generated.'); }
    catch (e) { alert('Error: ' + e.message); }
    finally { setGenerating(null); }
  }

  async function resolve(id) {
    await entityApi.patch(`/api/issues/${id}`, { status: 'RESOLVED' });
    loadIssues();
  }

  const sevOrder = { CRITICAL:0, HIGH:1, MEDIUM:2, LOW:3 };
  const sorted = [...issues].sort((a,b) => (sevOrder[a.severity]??9) - (sevOrder[b.severity]??9));

  return (
    <div className="page-content">
      <h1>Issues</h1>
      <p className="subtitle">Detected problems with your business data</p>
      <div className="e-card" style={{marginBottom:16}}>
        <div style={{display:'flex',gap:12,alignItems:'end',flexWrap:'wrap'}}>
          <div className="form-group" style={{flex:1,minWidth:200,marginBottom:0}}><label>Entity</label>
            <select value={sel} onChange={e=>setSel(e.target.value)}>{entities.map(e=><option key={e.id} value={e.id}>{e.brand_name||e.legal_name}</option>)}</select>
          </div>
          <div className="form-group" style={{minWidth:140,marginBottom:0}}><label>Status</label>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
              <option value="">All</option><option value="OPEN">Open</option><option value="IN_PROGRESS">In Progress</option>
              <option value="NEEDS_APPROVAL">Needs Approval</option><option value="RESOLVED">Resolved</option><option value="IGNORED">Ignored</option>
            </select>
          </div>
        </div>
      </div>
      <div className="e-card">
        {loading ? <div className="loading"><div className="spinner"/>Loading...</div> : sorted.length===0 ? <div className="empty-state"><p>{statusFilter==='OPEN'?'No open issues — great!':'No issues match filter.'}</p></div> : (
          <table className="e-table">
            <thead><tr><th>Issue</th><th>Severity</th><th>Status</th><th>Type</th><th>Who Acts</th><th>Detected</th>{isAdmin&&<th>Actions</th>}</tr></thead>
            <tbody>
              {sorted.map(i => (
                <tr key={i.id}>
                  <td><div style={{fontWeight:600}}>{i.title}</div>{i.description&&<div className="e-meta" style={{maxWidth:250,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{i.description}</div>}</td>
                  <td><span className={`badge badge-${i.severity==='CRITICAL'?'red':i.severity==='HIGH'?'amber':i.severity==='MEDIUM'?'warn':'off'}`}>{i.severity}</span></td>
                  <td><span className="badge badge-blue">{i.status}</span></td>
                  <td style={{fontSize:12}}>{i.issue_type}</td>
                  <td style={{fontSize:12}}>
                    {i.client_action_required&&<span className="badge badge-amber" style={{marginRight:4}}>Client</span>}
                    {i.admin_action_required&&<span className="badge badge-blue">Admin</span>}
                    {i.auto_fixable&&<span className="badge badge-ok">Auto</span>}
                  </td>
                  <td className="e-meta">{new Date(i.detected_at).toLocaleDateString()}</td>
                  {isAdmin&&<td>
                    <div style={{display:'flex',gap:4}}>
                      {i.status==='OPEN'&&i.client_action_required&&<button className="btn btn-connect btn-sm" onClick={()=>genPacket(i.id)} disabled={generating===i.id}>{generating===i.id?'...':'Packet'}</button>}
                      {i.status!=='RESOLVED'&&<button className="btn btn-sm btn-reconnect" onClick={()=>resolve(i.id)}>Resolve</button>}
                    </div>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
