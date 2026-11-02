import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.json'] })],
  test: {
    // Keep DOM-heavy workspaces bounded alongside package builds and PHP tests.
    maxWorkers: 1,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'examples/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.worktrees', 'dist'],
  },
})
