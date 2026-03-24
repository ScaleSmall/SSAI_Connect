import React, { useState, useEffect, useCallback } from 'react';
import { ConnectPanel } from 'ssai-shared';
import 'ssai-shared/src/connect.css';

const SUPABASE_URL = 'https://oyyfpkpzalhxztpcdjgq.supabase.co';

const STEPS = [
  { key: 'services', label: 'Define Services', icon: '🏷' },
  { key: 'photo_source', label: 'Photo Source', icon: '📸' },
  { key: 'platforms', label: 'Social Platforms', icon: '📱' },
  { key: 'billing', label: 'Subscribe', icon: '💳' },
];

export default function OnboardingWizard({ user, supabase, services, getToken, onComplete }) {
  const clientId = user?.n8n_client_id;
  const [step, setStep] = useState(0);
  const [svcList, setSvcList] = useState([]);
  const [newSvc, setNewSvc] = useState('');
  const [newKw, setNewKw] = useState('');
  const [saving, setSaving] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const callSvcApi = useCallback(async (method, body) => {
    const { data: { session } } = await supabase.auth.getSession();
    const opts = { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` } };
    if (body) opts.body = JSON.stringify(body);
    return (await fetch(`${SUPABASE_URL}/functions/v1/client-services`, opts)).json();
  }, [supabase]);

  useEffect(() => { loadServices(); }, []);

  async function loadServices() {
    const data = await callSvcApi('GET');
    setSvcList(data.services || []);
  }

  async function addService(e) {
    e.preventDefault();
    if (!newSvc.trim()) return;
    setSaving(true);
    const keywords = newKw.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    await callSvcApi('POST', { action: 'add', service_name: newSvc.trim(), service_keywords: keywords, is_primary: svcList.length === 0 });
    setNewSvc(''); setNewKw('');
    await loadServices();
    setSaving(false);
  }

  async function removeService(id) {
    await callSvcApi('POST', { action: 'delete', id });
    await loadServices();
  }

  async function startCheckout() {
    setCheckoutLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ service: 'jobs_to_socials', success_url: window.location.origin + '?billing=success', cancel_url: window.location.href }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) { console.error(e); }
    finally { setCheckoutLoading(false); }
  }

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Welcome to Scale Small AI</h1>
        <p style={{ color: '#94a3b8' }}>Let's get <strong>{user?.business_name}</strong> set up in a few quick steps</p>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {STEPS.map((s, i) => (
          <div key={s.key} style={{ flex: 1 }}>
            <div style={{ height: 4, borderRadius: 2, background: i <= step ? '#3b82f6' : '#1e293b', transition: 'background 0.3s' }} />
            <div style={{ fontSize: 11, color: i === step ? '#f1f5f9' : '#64748b', marginTop: 4, textAlign: 'center' }}>
              {s.icon} {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="sc-panel" style={{ minHeight: 300 }}>

        {/* STEP 0: Services */}
        {step === 0 && (
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>What services do you offer?</h2>
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
              Our AI analyzes your job photos and uses these to write accurate captions. Add at least one.
            </p>

            {svcList.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', marginBottom: 6, background: '#1e293b', borderRadius: 6, gap: 8 }}>
                <span style={{ flex: 1, fontWeight: 500 }}>{s.service_name}</span>
                {s.service_keywords?.length > 0 && <span style={{ fontSize: 11, color: '#64748b' }}>{s.service_keywords.join(', ')}</span>}
                <button onClick={() => removeService(s.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}

            <form onSubmit={addService} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <input value={newSvc} onChange={e => setNewSvc(e.target.value)} placeholder="Service name (e.g., Exterior Painting)"
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 14 }} />
              <input value={newKw} onChange={e => setNewKw(e.target.value)} placeholder="Keywords (comma-separated, e.g., exterior, siding, trim)"
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 12 }} />
              <button type="submit" disabled={saving || !newSvc.trim()}
                style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 600, alignSelf: 'flex-start', opacity: !newSvc.trim() ? 0.5 : 1 }}>
                {saving ? 'Adding...' : '+ Add Service'}
              </button>
            </form>
          </div>
        )}

        {/* STEP 1: Photo Source */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>Connect your photo source</h2>
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
              Connect CompanyCam or another photo source so we can automatically import your job photos.
            </p>
            <ConnectPanel clientId={clientId} supabaseUrl={SUPABASE_URL} businessName={user?.business_name} services={services} getToken={getToken} className="wizard-connect" />
          </div>
        )}

        {/* STEP 2: Social Platforms */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>Connect your social accounts</h2>
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
              Connect each platform where you want us to post. You can always add or remove platforms later.
            </p>
            <ConnectPanel clientId={clientId} supabaseUrl={SUPABASE_URL} businessName={user?.business_name} services={services} getToken={getToken} />
          </div>
        )}

        {/* STEP 3: Billing */}
        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>You're all set!</h2>
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>
              Subscribe to activate your services. You can change or cancel anytime.
            </p>
            <div style={{ background: '#1e293b', borderRadius: 10, padding: 24, display: 'inline-block', textAlign: 'left', minWidth: 300 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>📸 Proof-of-Work</div>
              <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>Job photos → social proof across all your connected platforms, fully automated.</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6', marginBottom: 16 }}>$250/mo</div>
              <button onClick={startCheckout} disabled={checkoutLoading}
                style={{ width: '100%', padding: '10px 0', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {checkoutLoading ? 'Redirecting to Stripe...' : 'Subscribe Now'}
              </button>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 8, textAlign: 'center' }}>Secure checkout powered by Stripe</div>
            </div>
            <div style={{ marginTop: 16 }}>
              <button onClick={onComplete} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13 }}>
                Skip for now — I'll subscribe later
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
          style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #334155', background: 'transparent', color: step === 0 ? '#334155' : '#94a3b8', cursor: step === 0 ? 'default' : 'pointer', fontSize: 13 }}>
          ← Back
        </button>
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(step + 1)}
            style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {step === 0 && svcList.length === 0 ? 'Skip for now →' : 'Next →'}
          </button>
        ) : null}
      </div>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <button onClick={onComplete} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>
          Skip wizard — go to full Connect page
        </button>
      </div>
    </div>
  );
}
