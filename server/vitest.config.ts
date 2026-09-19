import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    testTimeout: 60_000,
    hookTimeout: 300_000,
    include: ['tests/**/*.test.ts'],
    pool: 'forks',
    fileParallelism: false,
  },
});
