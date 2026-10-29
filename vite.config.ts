import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Only the GitHub Pages homologation build uses a repository subpath.
// Vercel and local builds keep their existing '/' base unchanged.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'github-pages' ? '/MAPA-COSTALOG/' : '/'
}));
