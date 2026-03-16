import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { entityApi } from '../../lib/entity-api';

export default function EntityAdmin({ user }) {
  const [stats, setStats] = useState(null);
  const [budget, setBudget] = useState(null);
  const [failures, setFailures] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); const i = setInterval(loadAll, 30000); return ()=>clearInterval(i); }, []);

  async function loadAll() {
    const [s,b] = await Promise.all([entityApi.get('/api/admin/stats').catch(()=>null), entityApi.get('/api/admin/budget').catch(()=>null)]);
    if (s?.data) setStats(s.data); if (b?.data) setBudget(b.data);
    const [f,j] = await Promise.all([
      supabase.from('failure_events').select('*').order('occurred_at',{ascending:false}).limit(25),
      supabase.from('job_queue').select('*').in('status',['QUEUED','RUNNING','FAILED']).order('priority').limit(25),
    ]);
    setFailures(f.data||[]); setJobs(j.data||[]); setLoading(false);
  }

  if (loading) return <div className="page-content"><div className="loading"><div className="spinner"/>Loading...</div></div>;

  return (
    <div className="page-content">
      <h1>System Health</h1>
      <p className="subtitle">Entity system monitoring, job queue, and SERP budget</p>
      <div className="stat-grid stat-grid-4" style={{marginBottom:16}}>
        <div className="stat-card"><div className="stat-label">Active Entities</div><div className="stat-value">{stats?.entities?.active??'—'}</div></div>
        <div className="stat-card"><div className="stat-label">Open Issues</div><div className="stat-value" style={{color:(stats?.issues?.critical||0)>0?'var(--red)':'inherit'}}>{stats?.issues?.open??'—'}</div></div>
        <div className="stat-card"><div className="stat-label">Job Queue</div><div className="stat-value">{(stats?.jobs?.queued||0)+(stats?.jobs?.running||0)}</div></div>
        <div className="stat-card"><div className="stat-label">Failures (24h)</div><div className="stat-value" style={{color:(stats?.failures_24h?.total||0)>0?'var(--red)':'var(--green)'}}>{stats?.failures_24h?.total??0}</div></div>
      </div>
      {budget && (
        <div className="stat-grid stat-grid-3" style={{marginBottom:16}}>
          <div className="stat-card"><div className="stat-label">SERP Used</div><div className="stat-value">{budget.serp_queries_used}</div><div className="stat-sub">of {budget.serp_queries_limit}</div></div>
          <div className="stat-card"><div className="stat-label">Scans (7d)</div><div className="stat-value">{stats?.scans_7d?.total??0}</div><div className="stat-sub">{stats?.scans_7d?.succeeded||0} ok · {stats?.scans_7d?.failed||0} fail</div></div>
          <div className="stat-card"><div className="stat-label">Active Widgets</div><div className="stat-value" style={{color:'var(--green)'}}>{stats?.widgets?.active??0}</div></div>
        </div>
      )}
      <div className="e-card" style={{marginBottom:16}}>
        <div className="e-card-head"><span className="e-card-title">Job Queue</span><button className="btn btn-sm btn-reconnect" onClick={loadAll}>Refresh</button></div>
        {jobs.length===0?<div className="empty-state" style={{padding:12}}><p>No active/failed jobs</p></div>:(
          <table className="e-table"><thead><tr><th>Type</th><th>Status</th><th>Priority</th><th>Attempts</th><th>Created</th></tr></thead>
            <tbody>{jobs.map(j=><tr key={j.id}><td style={{fontWeight:500}}>{j.job_type}</td><td><span className={`badge ${j.status==='RUNNING'?'badge-blue':j.status==='FAILED'?'badge-red':'badge-off'}`}>{j.status}</span></td><td className="mono">{j.priority}</td><td className="mono">{j.attempts}</td><td className="e-meta">{new Date(j.created_at).toLocaleString()}</td></tr>)}</tbody>
          </table>
        )}
      </div>
      <div className="e-card">
        <div className="e-card-head"><span className="e-card-title">Recent Failures</span></div>
        {failures.length===0?<div className="empty-state" style={{padding:12}}><p>No recent failures</p></div>:(
          <table className="e-table"><thead><tr><th>Component</th><th>Type</th><th>Severity</th><th>Cause</th><th>Occurred</th></tr></thead>
            <tbody>{failures.map(f=><tr key={f.id}><td><span className="badge badge-blue">{f.component}</span></td><td style={{fontSize:12}}>{f.failure_type}</td><td><span className={`badge badge-${f.severity==='CRITICAL'?'red':f.severity==='HIGH'?'amber':'off'}`}>{f.severity}</span></td><td className="e-meta" style={{maxWidth:250,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.root_cause_summary||'—'}</td><td className="e-meta">{new Date(f.occurred_at).toLocaleString()}</td></tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
