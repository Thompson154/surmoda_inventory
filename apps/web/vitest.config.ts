import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@surmoda/contracts': path.resolve(__dirname, '../../packages/contracts/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
      thresholds: {
        lines: 60,
        statements: 60,
        branches: 50,
        functions: 60,
      },
    },
  },
});
