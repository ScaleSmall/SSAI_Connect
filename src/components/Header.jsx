import React from 'react';

export default function Header({ user, onLogout }) {
  return (
    <header className="header">
      <div className="header-inner">
        <a className="logo-group" href="https://scalesmall.ai">
          <img src="https://scalesmall.ai/logo.png" alt="SCALE SMALL.AI" width="48" height="48" />
          <div className="logo-text">
            <div className="logo-brand">
              <span className="w1">SCALE</span>
              <span className="w2">SMALL.AI</span>
            </div>
            <span className="logo-tagline">Small Business Focused</span>
          </div>
        </a>
        {user && onLogout && (
          <div className="header-right">
            <span className="header-user">{user.business_name || user.email}</span>
            <button className="header-btn" onClick={onLogout}>Log Out</button>
          </div>
        )}
      </div>
    </header>
  );
}
