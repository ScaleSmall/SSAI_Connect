import React, { useState } from 'react';
import { entityApi } from '../../lib/entity-api';

const INIT = { legal_name:'',brand_name:'',website_url:'',public_phone_e164:'',public_phone_display:'',public_email:'',business_type:'UNKNOWN',address_visibility:'UNKNOWN',primary_category:'',contact_name:'',contact_email:'',address:{line1:'',line2:'',city:'',region:'',postal_code:'',country_code:'US'} };

export default function EntityOnboarding({ user }) {
  const [form, setForm] = useState(INIT);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const upd = (f,v) => setForm(p => ({...p,[f]:v}));
  const updAddr = (f,v) => setForm(p => ({...p,address:{...p.address,[f]:v}}));

  async function submit() {
    setSubmitting(true); setStatus(null);
    try {
      const r = await entityApi.post('/api/onboarding/submit', {...form, account_id: user.id});
      setResult(r.data); setStatus({type:'ok',msg:'Entity onboarded!'}); setStep(3);
    } catch(e) { setStatus({type:'err',msg:e.message}); }
    finally { setSubmitting(false); }
  }

  const steps = ['Business Info','Address & Contact','Review','Complete'];

  return (
    <div className="page-content">
      <h1>Onboard New Entity</h1>
      <p className="subtitle">Register a business into the Local Entity System</p>

      <div style={{display:'flex',gap:8,marginBottom:24}}>
        {steps.map((label,i)=>(
          <div key={i} onClick={()=>{if(i<step)setStep(i)}} style={{flex:1,padding:'10px 16px',borderRadius:8,background:i===step?'var(--blue-accent)':i<step?'rgba(96,165,250,0.15)':'var(--navy-700)',color:i===step?'var(--navy-900)':i<step?'var(--blue-accent)':'var(--slate-500)',fontSize:12,fontWeight:600,textAlign:'center',cursor:i<step?'pointer':'default'}}>{label}</div>
        ))}
      </div>

      <div className="e-card">
        {step===0&&<>
          <div className="form-row"><div className="form-group"><label>Legal Name *</label><input value={form.legal_name} onChange={e=>upd('legal_name',e.target.value)} placeholder="Hill Country Painting LLC"/></div><div className="form-group"><label>Brand Name</label><input value={form.brand_name} onChange={e=>upd('brand_name',e.target.value)} placeholder="Hill Country Painting"/></div></div>
          <div className="form-row"><div className="form-group"><label>Website</label><input value={form.website_url} onChange={e=>upd('website_url',e.target.value)} placeholder="https://hillcopaint.com"/></div><div className="form-group"><label>Category</label><input value={form.primary_category} onChange={e=>upd('primary_category',e.target.value)} placeholder="Painter"/></div></div>
          <div className="form-row"><div className="form-group"><label>Phone (E.164)</label><input value={form.public_phone_e164} onChange={e=>upd('public_phone_e164',e.target.value)} placeholder="+15125551234"/></div><div className="form-group"><label>Phone (Display)</label><input value={form.public_phone_display} onChange={e=>upd('public_phone_display',e.target.value)} placeholder="(512) 555-1234"/></div></div>
          <div className="form-row"><div className="form-group"><label>Business Type</label><select value={form.business_type} onChange={e=>upd('business_type',e.target.value)}><option value="UNKNOWN">Unknown</option><option value="STOREFRONT">Storefront</option><option value="SAB">SAB</option><option value="HYBRID">Hybrid</option></select></div><div className="form-group"><label>Address Visibility</label><select value={form.address_visibility} onChange={e=>upd('address_visibility',e.target.value)}><option value="UNKNOWN">Unknown</option><option value="PUBLIC">Public</option><option value="HIDDEN">Hidden (SAB)</option></select></div></div>
          <button className="btn btn-connect" onClick={()=>setStep(1)} disabled={!form.legal_name}>Next →</button>
        </>}
        {step===1&&<>
          <div className="section-label">Address</div>
          <div className="form-row"><div className="form-group"><label>Street</label><input value={form.address.line1} onChange={e=>updAddr('line1',e.target.value)}/></div><div className="form-group"><label>Suite</label><input value={form.address.line2} onChange={e=>updAddr('line2',e.target.value)}/></div></div>
          <div className="form-row-3"><div className="form-group"><label>City</label><input value={form.address.city} onChange={e=>updAddr('city',e.target.value)}/></div><div className="form-group"><label>State</label><input value={form.address.region} onChange={e=>updAddr('region',e.target.value)}/></div><div className="form-group"><label>Zip</label><input value={form.address.postal_code} onChange={e=>updAddr('postal_code',e.target.value)}/></div></div>
          <div className="section-label" style={{marginTop:20}}>Contact</div>
          <div className="form-row"><div className="form-group"><label>Name *</label><input value={form.contact_name} onChange={e=>upd('contact_name',e.target.value)}/></div><div className="form-group"><label>Email *</label><input value={form.contact_email} onChange={e=>upd('contact_email',e.target.value)} type="email"/></div></div>
          <div style={{display:'flex',gap:8}}><button className="btn btn-reconnect" onClick={()=>setStep(0)}>← Back</button><button className="btn btn-connect" onClick={()=>setStep(2)} disabled={!form.contact_name||!form.contact_email}>Next →</button></div>
        </>}
        {step===2&&<>
          <table className="e-table"><tbody>
            <tr><td style={{fontWeight:600,width:140}}>Legal Name</td><td>{form.legal_name}</td></tr>
            <tr><td style={{fontWeight:600}}>Brand</td><td>{form.brand_name||'—'}</td></tr>
            <tr><td style={{fontWeight:600}}>Website</td><td>{form.website_url||'—'}</td></tr>
            <tr><td style={{fontWeight:600}}>Phone</td><td>{form.public_phone_display||form.public_phone_e164||'—'}</td></tr>
            <tr><td style={{fontWeight:600}}>Type</td><td><span className="badge badge-ok">{form.business_type}</span></td></tr>
            <tr><td style={{fontWeight:600}}>Address</td><td>{[form.address.line1,form.address.city,form.address.region,form.address.postal_code].filter(Boolean).join(', ')||'—'}</td></tr>
            <tr><td style={{fontWeight:600}}>Contact</td><td>{form.contact_name} ({form.contact_email})</td></tr>
          </tbody></table>
          <div style={{display:'flex',gap:8,marginTop:16}}><button className="btn btn-reconnect" onClick={()=>setStep(1)}>← Back</button><button className="btn btn-connect" onClick={submit} disabled={submitting}>{submitting?'Submitting...':'Submit & Onboard'}</button></div>
        </>}
        {step===3&&result&&<>
          <div style={{textAlign:'center',padding:24}}>
            <div style={{fontSize:48,marginBottom:16}}>✓</div>
            <h2 style={{fontSize:20,fontWeight:700,marginBottom:8}}>Entity Onboarded!</h2>
            <p className="subtitle">Scan has been queued automatically.</p>
          </div>
          <div className="e-card" style={{background:'var(--navy-950)'}}>
            <div style={{marginBottom:12}}><strong>Entity ID:</strong> <code className="mono">{result.entity_id}</code></div>
            <div style={{marginBottom:12}}><strong>Widget Token:</strong> <code className="mono">{result.widget_token}</code></div>
            <div><strong>Snippet:</strong><div className="embed-code" style={{marginTop:8}}>{result.widget_snippet}</div></div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:16}}><button className="btn btn-connect" onClick={()=>{setStep(0);setForm(INIT);setResult(null);setStatus(null);}}>Onboard Another</button></div>
        </>}
        {status&&step!==3&&<div className={status.type==='err'?'login-error':'toast'} style={{marginTop:12,position:'static',transform:'none',animation:'none'}}>{status.msg}</div>}
      </div>
    </div>
  );
}
