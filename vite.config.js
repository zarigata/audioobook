import { defineConfig } from 'vite';

export default defineConfig({
  base: '/audioobook/',
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        format: 'es',
      },
    },
  },
  worker: {
    format: 'es',
  },
});
