import React, { useState } from 'react';

const SUPABASE_URL = 'https://oyyfpkpzalhxztpcdjgq.supabase.co';

export default function SubscriptionBanner({ user, supabase }) {
  const [loading, setLoading] = useState(false);
  const subStatus = user?.subscription_status;
  const hasStripe = !!user?.customer_id;

  async function openPortal() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ return_url: window.location.href }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function startCheckout() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          service: 'jobs_to_socials',
          success_url: window.location.origin + '?billing=success',
          cancel_url: window.location.href,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  if (subStatus === 'active') {
    return (
      <div style={{ padding: '12px 16px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontWeight: 600, color: '#22c55e' }}>✓ Subscription active</span>
          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>Your services are running</span>
        </div>
        {hasStripe && <button onClick={openPortal} disabled={loading} style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>{loading ? '...' : 'Manage billing'}</button>}
      </div>
    );
  }

  if (subStatus === 'past_due') {
    return (
      <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontWeight: 600, color: '#ef4444' }}>⚠ Payment failed</span>
          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>Update your payment method to keep services running</span>
        </div>
        <button onClick={openPortal} disabled={loading} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{loading ? '...' : 'Update payment'}</button>
      </div>
    );
  }

  // No subscription
  return (
    <div style={{ padding: '16px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 2 }}>Subscribe to activate your services</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Connect your platforms now — you can subscribe when you're ready</div>
      </div>
      <button onClick={startCheckout} disabled={loading} style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{loading ? 'Loading...' : 'Subscribe'}</button>
    </div>
  );
}
