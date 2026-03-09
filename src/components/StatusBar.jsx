import React from 'react';

export default function StatusBar({ connected, expired, needsSetup, disabled }) {
  return (
    <div className="status-bar">
      <div className="stat"><span className="dot dot-green" />{connected} connected</div>
      {expired > 0 && <div className="stat"><span className="dot dot-amber" />{expired} expired</div>}
      {needsSetup > 0 && <div className="stat"><span className="dot dot-red" />{needsSetup} needs setup</div>}
      {disabled > 0 && <div className="stat"><span className="dot dot-off" />{disabled} disabled</div>}
    </div>
  );
}
