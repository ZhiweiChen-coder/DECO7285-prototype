import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Exclude UI tests from Vitest - they should be run with Playwright
    exclude: ['**/ui-tests/**', '**/node_modules/**'],
    testTimeout: 30000, // 30 second timeout for integration tests
    hookTimeout: 30000,
  },
});
