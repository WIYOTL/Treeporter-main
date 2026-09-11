import { defineConfig } from 'vitest/config'

// Config Vitest séparée de vite.config.ts pour ne pas mélanger le plugin PWA
// (génération de service worker) avec l'exécution des tests. Ne teste que la
// logique pure des services (src/services/*.ts) — pas les composants React.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})