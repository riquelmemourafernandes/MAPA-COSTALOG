import React from 'react';
import { createRoot } from 'react-dom/client';
import App, { referenceHeader } from './App';
import LocalDemoApp from './LocalDemoApp';
import './styles.css';
import './costalog-brand-theme.css';

// GitHub Pages is deliberately frontend-only: it never calls the legacy API
// and never presents the local demo as secure authentication.
const isPublicPages = window.location.hostname === 'riquelmemourafernandes.github.io' &&
  window.location.pathname.startsWith('/MAPA-COSTALOG/');

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPublicPages ? <LocalDemoApp headers={referenceHeader} /> : <App />}
  </React.StrictMode>
);
