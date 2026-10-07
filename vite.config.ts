import { defineConfig, type Plugin } from 'vite';

/**
 * The game ships as ONE classic script (no type="module") so the built
 * index.html also works when opened straight from the unzipped folder
 * (file://), which blocks ES modules. Everything is bundled: no CDN, no fonts.
 */
const classicScript = (): Plugin => ({
  name: 'kisshug-classic-script',
  transformIndexHtml(html) {
    return html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, '<script src="$1"></script>').replace(/<link rel="modulepreload"[^>]*>/g, '');
  },
});

export default defineConfig(({ mode }) => ({
  base: './',
  publicDir: 'assets',
  plugins: [classicScript()],
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
    rollupOptions: {
      output: { format: 'iife', inlineDynamicImports: true, entryFileNames: 'assets/kisshug.js', assetFileNames: 'assets/[name][extname]' },
    },
  },
  worker: { format: 'iife', rollupOptions: { output: { entryFileNames: 'assets/ai-worker.js' } } },
  server: { port: 5173, strictPort: true },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120000,
  },
}));
