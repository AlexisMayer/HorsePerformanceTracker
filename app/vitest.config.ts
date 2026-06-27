import { defineConfig } from 'vitest/config';

/**
 * Tests unitaires de l'app — **logique pure**, exécutée en environnement Node
 * (pas de rendu React Native). On couvre ici les briques non triviales et
 * critiques de la DoD du lot 1.4 : persistance du refresh en secure storage et
 * rafraîchissement automatique sur 401 (interceptor). Les composants/écrans sont
 * couverts par le typecheck (`tsc --noEmit`) ; leur structure de navigation est
 * vérifiée via la config `TABS` (source unique).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
