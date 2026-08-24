import { defineConfig } from 'vitest/config';

// Los tests crean un schema efimero en PostgreSQL (Neon) y aplican
// migraciones por red: hooks lentos, timeouts generosos.
export default defineConfig({
  test: {
    hookTimeout: 240_000,
    testTimeout: 60_000,
    teardownTimeout: 60_000,
    // Secuencial: cada archivo migra su schema y Prisma toma un advisory lock
    // global en la base; en paralelo el lock expira a los 10s.
    fileParallelism: false,
  },
});
