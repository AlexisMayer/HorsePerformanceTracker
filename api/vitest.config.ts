import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    root: './',
  },
  // SWC keeps NestJS decorator metadata at test time, matching the build.
  plugins: [swc.vite()],
});
