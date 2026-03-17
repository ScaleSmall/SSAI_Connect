import React, { useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_URL } from './supabase';
import { ConnectPanel, Toast } from 'ssai-shared';
import 'ssai-shared/src/connect.css';
import Header from './components/Header';
import LoginForm from './components/LoginForm';
import Footer from './components/Footer';

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [services, setServices] = useState([]);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) { setUser(null); setServices([]); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    async function fetchUser() {
      const { data, error: err } = await supabase
        .from('users')
        .select('id, email, business_name, n8n_client_id')
        .eq('id', session.user.id)
        .single();
      if (err || !data) { setError('Could not find your account. Contact support.'); return; }
      if (!data.n8n_client_id) { setError('No client ID linked to your account yet. Complete onboarding first.'); return; }
      setUser(data);
      setError(null);

      // Fetch services_enabled from client_profiles
      const { data: cp } = await supabase
        .from('client_profiles')
        .select('services_enabled')
        .eq('client_id', data.n8n_client_id)
        .single();
      setServices(cp?.services_enabled || []);
    }
    fetchUser();
  }, [session]);

  const getToken = useCallback(async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    return s?.access_token;
  }, []);

  // OAuth return toast
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('status') === 'success') {
      const pn = params.get('platform') || 'Platform';
      setToast(`✓ ${pn.charAt(0).toUpperCase() + pn.slice(1)} connected successfully`);
      const url = new URL(window.location);
      ['status', 'platform', 'warnings'].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState({}, '', url);
    }
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null); setUser(null);
  };

  if (authLoading) {
    return (<><Header /><main className="main-content"><div className="loading"><div className="spinner" />Loading...</div></main><Footer /></>);
  }

  if (!session) {
    return (<><Header /><main className="main-content"><LoginForm /></main><Footer /></>);
  }

  if (!user) {
    return (
      <><Header user={user || { email: session.user.email }} onLogout={handleLogout} />
        <main className="main-content">
          {error
            ? (<><h1>Connect Your Platforms</h1><div className="error-box">{error}</div></>)
            : (<div className="loading"><div className="spinner" />Loading platform status…</div>)}
        </main><Footer /></>
    );
  }

  return (
    <>
      <Header user={user} onLogout={handleLogout} />
      <main className="main-content">
        <h1>Connect Your Platforms</h1>
        <p className="subtitle">
          Connect each platform so <strong>Scale Small AI</strong> can
          create and publish content on behalf of{' '}
          <strong>{user.business_name}</strong>.
        </p>

        <ConnectPanel
          clientId={user.n8n_client_id}
          supabaseUrl={SUPABASE_URL}
          businessName={user.business_name}
          services={services}
          getToken={getToken}
        />
      </main>

      <Footer />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
