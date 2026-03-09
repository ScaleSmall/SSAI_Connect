import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './supabase';
import { OAUTH_STATUS_URL, PLATFORM_ORDER, PLATFORM_META } from './config';
import Header from './components/Header';
import LoginForm from './components/LoginForm';
import StatusBar from './components/StatusBar';
import PlatformCard from './components/PlatformCard';
import Toast from './components/Toast';
import Footer from './components/Footer';

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);       // from public.users table
  const [platforms, setPlatforms] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // ── Auth listener ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setUser(null);
        setPlatforms(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Fetch user profile (to get n8n_client_id) ──
  useEffect(() => {
    if (!session?.user?.id) return;

    async function fetchUser() {
      const { data, error: err } = await supabase
        .from('users')
        .select('id, email, business_name, n8n_client_id')
        .eq('id', session.user.id)
        .single();

      if (err || !data) {
        setError('Could not find your account. Contact support.');
        return;
      }
      if (!data.n8n_client_id) {
        setError('No client ID linked to your account yet. Complete onboarding first.');
        return;
      }
      setUser(data);
      setError(null);
    }

    fetchUser();
  }, [session]);

  // ── Fetch platform status once we have client_id ──
  const fetchPlatforms = useCallback(async () => {
    if (!user?.n8n_client_id) return;
    try {
      const res = await fetch(`${OAUTH_STATUS_URL}?client_id=${user.n8n_client_id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPlatforms(data.platforms || []);
    } catch (err) {
      setError(`Failed to load platforms: ${err.message}`);
    }
  }, [user]);

  useEffect(() => { fetchPlatforms(); }, [fetchPlatforms]);

  // ── OAuth return toast ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('status') === 'success') {
      const pn = params.get('platform') || 'Platform';
      setToast(`✓ ${pn.charAt(0).toUpperCase() + pn.slice(1)} connected successfully`);
      const url = new URL(window.location);
      ['status', 'platform', 'warnings'].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState({}, '', url);
      // Refresh platform list
      setTimeout(() => fetchPlatforms(), 500);
    }
  }, [fetchPlatforms]);

  // ── Logout ──
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setPlatforms(null);
  };

  // ── Platform counts ──
  const counts = useMemo(() => {
    if (!platforms) return { connected: 0, expired: 0, needsSetup: 0, disabled: 0 };
    let connected = 0, expired = 0, needsSetup = 0, disabled = 0;
    for (const p of platforms) {
      const meta = PLATFORM_META[p.platform];
      if (!meta || meta.hidden) continue;
      if (p.connected && !p.is_expired) connected++;
      else if (p.is_expired) expired++;
      else if (!p.enabled) disabled++;
      else needsSetup++;
    }
    return { connected, expired, needsSetup, disabled };
  }, [platforms]);

  // ── Sorted platforms: not connected first, then expired, then connected ──
  const sortedPlatforms = useMemo(() => {
    if (!platforms) return [];
    const visible = PLATFORM_ORDER
      .map((pid) => platforms.find((p) => p.platform === pid))
      .filter((p) => p && PLATFORM_META[p.platform] && !PLATFORM_META[p.platform].hidden);

    return visible.sort((a, b) => {
      const order = (p) => {
        if (!p.connected && !p.is_expired && p.enabled) return 0; // needs setup
        if (p.is_expired) return 1;                                 // expired
        if (!p.enabled) return 3;                                   // disabled
        return 2;                                                    // connected
      };
      return order(a) - order(b);
    });
  }, [platforms]);

  // ── Loading auth ──
  if (authLoading) {
    return (
      <>
        <Header />
        <main className="main-content">
          <div className="loading"><div className="spinner" />Loading...</div>
        </main>
        <Footer />
      </>
    );
  }

  // ── Not logged in ──
  if (!session) {
    return (
      <>
        <Header />
        <main className="main-content">
          <LoginForm />
        </main>
        <Footer />
      </>
    );
  }

  // ── Logged in but waiting for user profile / platforms ──
  if (!user || !platforms) {
    return (
      <>
        <Header user={user || { email: session.user.email }} onLogout={handleLogout} />
        <main className="main-content">
          {error ? (
            <>
              <h1>Connect Your Platforms</h1>
              <div className="error-box">{error}</div>
            </>
          ) : (
            <div className="loading"><div className="spinner" />Loading platform status…</div>
          )}
        </main>
        <Footer />
      </>
    );
  }

  // ── Dashboard ──
  return (
    <>
      <Header user={user} onLogout={handleLogout} />
      <main className="main-content">
        <h1>Connect Your Platforms</h1>
        <p className="subtitle">
          Authorize each social platform so <strong>Proof-of-Work</strong> can
          publish job photos automatically for{' '}
          <strong>{user.business_name}</strong>.
        </p>

        <StatusBar {...counts} />

        <div className="section-label">Platforms</div>
        <div className="platforms">
          {sortedPlatforms.map((p, i) => (
            <PlatformCard
              key={p.platform}
              platform={p}
              clientId={user.n8n_client_id}
              index={i}
            />
          ))}
        </div>
      </main>

      <Footer />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
