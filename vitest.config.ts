import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: 'shared', include: ['packages/shared/test/**/*.test.ts'] },
      },
      {
        test: {
          name: 'server',
          include: ['apps/server/test/**/*.test.ts'],
          environment: 'node',
          testTimeout: 20000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/shared/src/**', 'apps/server/src/**'],
      reporter: ['text-summary', 'text'],
    },
  },
});
