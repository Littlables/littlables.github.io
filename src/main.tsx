import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

// Global error catcher: displays JS crashes on-screen instead of white page
// (diagnostic for @-route white screens; remove once root cause is fixed)
window.addEventListener('error', (event) => {
  const msg = event.message || 'Unknown error';
  if (document.getElementById('global-error-overlay')) return;
  const div = document.createElement('div');
  div.id = 'global-error-overlay';
  div.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:99999;background:#7f1d1d;color:#fff;padding:12px;font-family:monospace;font-size:13px;word-break:break-word;';
  div.textContent = `Page error: ${msg}`;
  document.body.prepend(div);
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
