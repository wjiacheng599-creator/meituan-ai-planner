/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  void env;
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            motion: ['motion'],
            icons: ['lucide-react'],
            zustand: ['zustand', 'zustand/middleware'],
          },
        },
      },
      chunkSizeWarningLimit: 500,
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
      pure: mode === 'production' ? ['console.log', 'console.debug'] : [],
    },
    server: {
      host: '0.0.0.0',
      port: 3008,
      strictPort: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${process.env.API_PORT || '8788'}`,
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/test/**', 'src/**/*.d.ts', 'src/vite-env.d.ts'],
      },
    },
  };
});
