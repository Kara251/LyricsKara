import { defineConfig } from 'vite';

// 相对 base：本地、GitHub Pages（/Echoes-of-Longing/）皆可直接工作
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
