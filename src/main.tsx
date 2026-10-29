import React from 'react';
import { createRoot } from 'react-dom/client';
import { referenceHeader } from './reference-header.js';
import LocalDemoApp from './LocalDemoApp';
import './styles.css';
import './costalog-brand-theme.css';

const root = createRoot(document.getElementById('root')!);
const isPublicPages = window.location.hostname === 'riquelmemourafernandes.github.io' &&
  window.location.pathname.startsWith('/MAPA-COSTALOG/');

if (isPublicPages) {
  // The public Pages bundle starts directly in local demo mode. It never loads
  // the API-backed application, requests credentials, or calls an external API.
  root.render(<React.StrictMode><LocalDemoApp headers={referenceHeader} /></React.StrictMode>);
} else {
  // Keep the connected application available for future self-hosted deployment.
  void import('./App').then(({ default: App }) => {
    root.render(<React.StrictMode><App /></React.StrictMode>);
  });
}
