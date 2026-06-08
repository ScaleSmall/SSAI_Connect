import React, { useEffect, useMemo } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import { SUPABASE_URL } from './supabase';

const ROUTES = {
  '/referral': 'rr-referral',
  '/unsubscribe': 'rr-unsubscribe',
};

export default function RRPublicRedirect() {
  const target = useMemo(() => {
    const fn = ROUTES[window.location.pathname] || 'rr-referral';
    const url = new URL(`${SUPABASE_URL}/functions/v1/${fn}`);
    const source = new URLSearchParams(window.location.search);
    const token = source.get('token');
    if (token) url.searchParams.set('token', token);
    return url.toString();
  }, []);

  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <>
      <Header />
      <main className="main-content">
        <div className="handoff-card">
          <div className="spinner" />
          <h1>Opening secure page...</h1>
          <p className="subtitle">Taking you to the right Scale Small AI page.</p>
          <a className="header-btn" href={target}>Continue</a>
        </div>
      </main>
      <Footer />
    </>
  );
}
