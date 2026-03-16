import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { supabase } from './supabase';
import LoginForm from './components/LoginForm';
import Toast from './components/Toast';
import ConnectionsPage from './pages/ConnectionsPage';
import EntityDashboard from './pages/entity/EntityDashboard';
import EntityCitations from './pages/entity/EntityCitations';
import EntityProfiles from './pages/entity/EntityProfiles';
import EntityIssues from './pages/entity/EntityIssues';
import EntityAlerts from './pages/entity/EntityAlerts';
import EntityScans from './pages/entity/EntityScans';
import EntityAdmin from './pages/entity/EntityAdmin';
import EntityOnboarding from './pages/entity/EntityOnboarding';

const NAV = [
  { section: 'Services' },
  { to: '/connections', label: 'Connections', icon: '⚡' },
  { section: 'Local Entity' },
  { to: '/entity', label: 'Overview', icon: '◉' },
  { to: '/entity/citations', label: 'Citations', icon: '◎' },
  { to: '/entity/profiles', label: 'Profiles', icon: '◈' },
  { to: '/entity/issues', label: 'Issues', icon: '▲' },
  { to: '/entity/alerts', label: 'Alerts', icon: '◆' },
  { section: 'Admin', adminOnly: true },
  { to: '/entity/scans', label: 'Scans', icon: '↻', adminOnly: true },
  { to: '/entity/onboarding', label: 'Onboarding', icon: '＋', adminOnly: true },
  { to: '/entity/admin', label: 'System Health', icon: '⚙', adminOnly: true },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); if (!s) setUser(null); });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase.from('users').select('id,email,business_name,contact_name,n8n_client_id,admin_type,entity_role')
      .eq('id', session.user.id).single()
      .then(({ data }) => { if (data) { setUser(data); setError(null); } else setError('Account not found.'); });
  }, [session]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('status') === 'success') {
      const pn = p.get('platform') || 'Platform';
      setToast(`✓ ${pn.charAt(0).toUpperCase() + pn.slice(1)} connected`);
      const u = new URL(window.location); ['status','platform','warnings'].forEach(k => u.searchParams.delete(k));
      window.history.replaceState({}, '', u);
    }
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); setSession(null); setUser(null); };

  const isAdmin = user?.entity_role === 'admin' || user?.entity_role === 'super_admin'
    || user?.admin_type === 'super_admin' || user?.admin_type === 'sub_admin';

  const visibleNav = useMemo(() => {
    if (!user) return [];
    return NAV.filter(item => !(item.adminOnly && !isAdmin));
  }, [user, isAdmin]);

  if (authLoading) return <div className="app-loading"><div className="spinner" /><p>Loading...</p></div>;

  if (!session) return (
    <div className="login-page">
      <div className="login-header">
        <a className="logo-group" href="https://scalesmall.ai">
          <img src="https://scalesmall.ai/logo.png" alt="" width="48" height="48" />
          <div className="logo-text">
            <div className="logo-brand"><span className="w1">SCALE</span><span className="w2">SMALL.AI</span></div>
            <span className="logo-tagline">Small Business Focused</span>
          </div>
        </a>
      </div>
      <LoginForm />
    </div>
  );

  if (!user) return <div className="app-loading">{error ? <div className="error-box">{error}</div> : <><div className="spinner" /><p>Loading account...</p></>}</div>;

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="https://scalesmall.ai/logo.png" alt="" width="32" height="32" className="sidebar-logo" />
          <div className="sidebar-brand-text">
            <span className="brand-w1">SCALE</span><span className="brand-w2">SMALL.AI</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {visibleNav.map((item, i) =>
            item.section ? (
              <div key={`s${i}`} className="sidebar-section">{item.section}</div>
            ) : (
              <Link key={item.to} to={item.to}
                className={`sidebar-link${(item.to === '/entity' ? location.pathname === '/entity' : location.pathname.startsWith(item.to)) ? ' active' : ''}`}>
                <span className="sidebar-icon">{item.icon}</span>
                <span className="sidebar-label">{item.label}</span>
              </Link>
            )
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user-name">{user.contact_name || user.business_name || user.email}</div>
          <div className="sidebar-user-meta">
            {isAdmin ? <span className="role-admin">Admin</span> : <span className="role-client">Client</span>}
          </div>
          <button className="sidebar-logout" onClick={handleLogout}>Log Out</button>
        </div>
      </aside>
      <main className="dashboard-main">
        <Routes>
          <Route path="/" element={<Navigate to="/connections" replace />} />
          <Route path="/connections" element={<ConnectionsPage user={user} session={session} />} />
          <Route path="/entity" element={<EntityDashboard user={user} isAdmin={isAdmin} />} />
          <Route path="/entity/citations" element={<EntityCitations user={user} />} />
          <Route path="/entity/profiles" element={<EntityProfiles user={user} />} />
          <Route path="/entity/issues" element={<EntityIssues user={user} isAdmin={isAdmin} />} />
          <Route path="/entity/alerts" element={<EntityAlerts user={user} />} />
          {isAdmin && <>
            <Route path="/entity/scans" element={<EntityScans user={user} />} />
            <Route path="/entity/onboarding" element={<EntityOnboarding user={user} />} />
            <Route path="/entity/admin" element={<EntityAdmin user={user} />} />
          </>}
          <Route path="*" element={<Navigate to="/connections" replace />} />
        </Routes>
      </main>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
