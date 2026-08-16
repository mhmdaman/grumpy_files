import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run tests in a Node.js environment (not browser)
    environment: 'node',
    // Allow test files in the tests/ directory at root level
    include: ['tests/**/*.test.ts'],
    // Increase timeout for tests that hash files or walk large directories
    testTimeout: 30000,
    // Show verbose output so each test case is visible
    reporter: 'verbose',
  },
});
