import type { Cheval, Compte, Contexte, Obstacle, Séance, Tour } from '@hpt/shared';
import { describe, expectTypeOf, it } from 'vitest';
import type { cheval, compte, contexte, obstacle, seance, tour } from './schema';

/**
 * Alignement **Drizzle ↔ `shared`** vérifié **au niveau type** (cascade des
 * contrats, Architecture §2). C'est le mécanisme exigé par le lot 0.3 : les
 * lignes inférées par Drizzle (`$inferSelect`) doivent être cohérentes avec les
 * formes de domaine de `@hpt/shared` (lot 0.2).
 *
 * Ces assertions sont **purement statiques** : `expectTypeOf` ne produit aucun
 * code à l'exécution (corps de test vide), mais une divergence de type fait
 * **échouer `pnpm typecheck`** (donc la CI). Elles tournent aussi dans
 * `pnpm test` (sans base de données) puisque ce sont des specs Vitest standard.
 *
 * Seul écart de représentation **assumé** entre les deux mondes : un champ
 * optionnel du domaine (`x?: T`, soit `T | undefined`) est *nullable* en base
 * (`T | null`). `NullToOptional` normalise `… | null` en `…?` avant comparaison,
 * encodant la convention « NULL en base = champ absent du domaine ».
 */

/** Clés dont le type inféré admet `null` (colonnes nullable). */
type NullableKeys<T> = { [K in keyof T]-?: null extends T[K] ? K : never }[keyof T];

/**
 * Réécrit un type de ligne Drizzle dans la forme du domaine : chaque colonne
 * nullable devient une propriété optionnelle dont `null` est retiré ; les
 * colonnes `NOT NULL` restent requises à l'identique. L'`identité` mappée
 * (`[K in keyof …]`) aplatit l'intersection en un seul objet et **préserve** les
 * modificateurs `?`, ce qui rend la comparaison `toEqualTypeOf` exacte.
 */
type NullToOptional<T> = {
  [K in keyof ({ [P in Exclude<keyof T, NullableKeys<T>>]: T[P] } & {
    [P in NullableKeys<T>]?: Exclude<T[P], null>;
  })]: ({ [P in Exclude<keyof T, NullableKeys<T>>]: T[P] } & {
    [P in NullableKeys<T>]?: Exclude<T[P], null>;
  })[K];
};

describe('schéma Drizzle ↔ types `@hpt/shared` (alignement au niveau type)', () => {
  it('Compte', () => {
    expectTypeOf<NullToOptional<typeof compte.$inferSelect>>().toEqualTypeOf<Compte>();
  });

  it('Cheval', () => {
    expectTypeOf<NullToOptional<typeof cheval.$inferSelect>>().toEqualTypeOf<Cheval>();
  });

  it('Séance', () => {
    expectTypeOf<NullToOptional<typeof seance.$inferSelect>>().toEqualTypeOf<Séance>();
  });

  it('Obstacle', () => {
    expectTypeOf<NullToOptional<typeof obstacle.$inferSelect>>().toEqualTypeOf<Obstacle>();
  });

  it('Tour', () => {
    expectTypeOf<NullToOptional<typeof tour.$inferSelect>>().toEqualTypeOf<Tour>();
  });

  it('Contexte', () => {
    expectTypeOf<NullToOptional<typeof contexte.$inferSelect>>().toEqualTypeOf<Contexte>();
  });
});
