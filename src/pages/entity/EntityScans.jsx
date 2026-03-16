import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../supabase';
import { entityApi } from '../../lib/entity-api';

export default function EntityScans({ user }) {
  const [entities, setEntities] = useState([]);
  const [sel, setSel] = useState('');
  const [runs, setRuns] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [runType, setRunType] = useState('ONBOARDING_SCAN');
  const poll = useRef(null);

  useEffect(() => {
    supabase.from('entities').select('id,legal_name,brand_name').eq('status','ACTIVE').order('legal_name')
      .then(({ data }) => { setEntities(data||[]); if (data?.length) setSel(data[0].id); });
    entityApi.get('/api/admin/budget').then(r=>setBudget(r.data)).catch(()=>{});
  }, []);

  useEffect(() => { if (sel) { loadRuns(); loadJobs(); } return () => { if (poll.current) clearInterval(poll.current); }; }, [sel]);

  async function loadRuns() { setLoading(true); const { data } = await supabase.from('scan_runs').select('*').eq('entity_id',sel).order('created_at',{ascending:false}).limit(20); setRuns(data||[]); setLoading(false); }
  async function loadJobs() {
    const { data } = await supabase.from('job_queue').select('*').eq('entity_id',sel).in('status',['QUEUED','RUNNING']).order('created_at',{ascending:false}).limit(10);
    setJobs(data||[]);
    if (data?.length && !poll.current) poll.current = setInterval(() => { loadRuns(); loadJobs(); }, 5000);
    else if (!data?.length && poll.current) { clearInterval(poll.current); poll.current = null; }
  }

  async function start() {
    setScanning(true); setResult(null);
    try { const r = await entityApi.post('/api/scans/start', { entity_id:sel, run_type:runType }); setResult(r); loadJobs(); entityApi.get('/api/admin/budget').then(r=>setBudget(r.data)).catch(()=>{}); }
    catch (e) { setResult({ ok:false, error:e.message }); }
    finally { setScanning(false); }
  }

  const activeJobs = jobs.filter(j=>['QUEUED','RUNNING'].includes(j.status));

  return (
    <div className="page-content">
      <h1>Scans</h1>
      <p className="subtitle">Citation discovery via SerpStack — scans run asynchronously</p>

      {budget && (
        <div className="e-card" style={{marginBottom:16}}>
          <div className="e-card-head"><span className="e-card-title">SERP Budget</span>
            <span className={`badge ${budget.serp_queries_remaining>20?'badge-ok':budget.serp_queries_remaining>5?'badge-amber':'badge-red'}`}>{budget.serp_queries_remaining} remaining</span>
          </div>
          <div style={{display:'flex',gap:24,fontSize:13,marginTop:8}}>
            <span><strong>{budget.serp_queries_used}</strong> <span className="e-meta">used</span></span>
            <span><strong>{budget.serp_queries_limit}</strong> <span className="e-meta">limit</span></span>
            <span className="e-meta">Provider: <strong style={{color:'var(--slate-50)'}}>{budget.provider}</strong></span>
          </div>
          <div style={{marginTop:10,background:'var(--navy-700)',borderRadius:4,height:6,overflow:'hidden'}}>
            <div style={{width:`${Math.min(100,(budget.serp_queries_used/budget.serp_queries_limit)*100)}%`,height:'100%',borderRadius:4,background:budget.serp_queries_remaining>20?'var(--green)':'var(--red)',transition:'width 0.3s'}}/>
          </div>
        </div>
      )}

      <div className="e-card" style={{marginBottom:16}}>
        <div className="e-card-head"><span className="e-card-title">Run a Scan</span></div>
        <div style={{display:'flex',gap:12,alignItems:'end',flexWrap:'wrap',marginTop:8}}>
          <div className="form-group" style={{flex:1,minWidth:200,marginBottom:0}}><label>Entity</label>
            <select value={sel} onChange={e=>setSel(e.target.value)}>{entities.map(e=><option key={e.id} value={e.id}>{e.brand_name||e.legal_name}</option>)}</select>
          </div>
          <div className="form-group" style={{minWidth:180,marginBottom:0}}><label>Type</label>
            <select value={runType} onChange={e=>setRunType(e.target.value)}>
              <option value="ONBOARDING_SCAN">Onboarding</option><option value="DISCOVERY_SCAN">Discovery</option><option value="DRIFT_CHECK">Drift Check</option>
            </select>
          </div>
          <button className="btn btn-connect" onClick={start} disabled={scanning||activeJobs.length>0} style={{marginBottom:0}}>
            {scanning?'Queuing...':activeJobs.length>0?'In Progress...':'Start Scan'}
          </button>
        </div>
        {result && <div className={`${result.ok===false?'login-error':'toast'}`} style={{marginTop:12,position:'static',transform:'none',animation:'none'}}>
          {result.ok===false?result.error:result.message}
        </div>}
      </div>

      {activeJobs.length>0 && (
        <div className="e-card" style={{marginBottom:16,borderLeft:'3px solid var(--blue-accent)'}}>
          <div className="e-card-head"><span className="e-card-title"><span className="spinner" style={{display:'inline-block',width:16,height:16,marginRight:8,borderWidth:2}}/>Active Jobs ({activeJobs.length})</span></div>
          <table className="e-table"><thead><tr><th>Type</th><th>Status</th><th>Attempts</th><th>Created</th></tr></thead>
            <tbody>{activeJobs.map(j=><tr key={j.id}><td>{j.job_type}</td><td><span className={`badge ${j.status==='RUNNING'?'badge-blue':'badge-off'}`}>{j.status}</span></td><td className="mono">{j.attempts}</td><td className="e-meta">{new Date(j.created_at).toLocaleString()}</td></tr>)}</tbody>
          </table>
        </div>
      )}

      <div className="e-card">
        <div className="e-card-head"><span className="e-card-title">Scan History</span><button className="btn btn-sm btn-reconnect" onClick={()=>{loadRuns();loadJobs();}}>Refresh</button></div>
        {loading ? <div className="loading"><div className="spinner"/>Loading...</div> : runs.length===0 ? <div className="empty-state"><p>No scans yet.</p></div> : (
          <table className="e-table"><thead><tr><th>Type</th><th>Status</th><th>By</th><th>Started</th><th>Finished</th><th>Results</th></tr></thead>
            <tbody>{runs.map(r=><tr key={r.id}>
              <td style={{fontWeight:500}}>{r.run_type}</td>
              <td><span className={`badge ${r.status==='SUCCEEDED'?'badge-ok':r.status==='PARTIAL'?'badge-amber':r.status==='RUNNING'?'badge-blue':r.status==='FAILED'?'badge-red':'badge-off'}`}>{r.status}</span></td>
              <td style={{fontSize:12}}>{r.triggered_by}</td>
              <td className="e-meta">{r.started_at?new Date(r.started_at).toLocaleString():'—'}</td>
              <td className="e-meta">{r.finished_at?new Date(r.finished_at).toLocaleString():r.status==='RUNNING'?<span style={{color:'var(--blue-accent)'}}>Running...</span>:'—'}</td>
              <td style={{fontSize:12}}>{r.totals_json?.queries_executed!=null&&<span>{r.totals_json.queries_executed}q · {r.totals_json.urls_discovered||0} URLs</span>}{r.had_failures&&<span className="badge badge-red" style={{marginLeft:6}}>{r.failure_count} fail</span>}</td>
            </tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
