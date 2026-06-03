import { defineConfig } from 'vite';

export default defineConfig({
  // For GitHub Pages project pages (e.g. username.github.io/LinkdinBot), set:
  //   base: '/LinkdinBot/'
  // For a custom domain or Netlify/Vercel root deployment, keep '/'.
  base: '/moti-profile/',
  build: {
    outDir: 'dist',
  },
});
