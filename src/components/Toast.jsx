import React, { useEffect } from 'react';

export default function Toast({ message, onDone, duration = 4000 }) {
  useEffect(() => {
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [onDone, duration]);

  return <div className="toast">{message}</div>;
}
