import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: './',
  publicDir: 'assets',
  define: {
    __PLAYABLES__: JSON.stringify(mode === 'playables'),
    __PHOTO_MODE_ENABLED__: JSON.stringify(true),
  },
  build: {
    outDir: mode === 'playables' ? 'dist-playables' : 'dist',
    target: 'es2019',
    assetsInlineLimit: 0,
    sourcemap: false,
    modulePreload: { polyfill: false },
  },
  worker: { format: 'es' },
  server: { port: 5173, strictPort: true },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120000,
  },
}));
