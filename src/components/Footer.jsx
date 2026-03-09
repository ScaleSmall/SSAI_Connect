import React from 'react';

export default function Footer() {
  return (
    <footer className="footer">
      <p>
        © {new Date().getFullYear()}{' '}
        <a href="https://scalesmall.ai">SCALE SMALL.AI</a>
        {'  ·  '}
        <a href="https://scalesmall.ai/privacy/">Privacy</a>
        {'  ·  '}
        <a href="https://scalesmall.ai/terms/">Terms</a>
        {'  ·  '}
        <a href="https://scalesmall.ai/data-deletion/">Data Deletion</a>
      </p>
    </footer>
  );
}
