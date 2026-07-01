import type {
  AccèsInvité,
  BilanAugmenté,
  Cheval,
  CombinaisonRéutilisable,
  Compte,
  Contexte,
  Obstacle,
  Séance,
  Tour,
} from '@hpt/shared';
import { describe, expectTypeOf, it } from 'vitest';
import type {
  accesInvite,
  bilanAugmente,
  cheval,
  combinaison,
  compte,
  contexte,
  obstacle,
  seance,
  tour,
} from './schema';

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
    // `idempotency_key` est une colonne **technique** ajoutée au lot 2.2 (clé
    // d'idempotence de création), **hors Modèle de données socle** : on l'exclut
    // de l'alignement avec la forme de domaine `Séance`, même posture que les
    // tables techniques `refresh_token` / `verification_token` (non alignées sur
    // `shared`). Le reste de la ligne reste fidèle au domaine (cf. journal 2.2).
    expectTypeOf<
      NullToOptional<Omit<typeof seance.$inferSelect, 'idempotency_key'>>
    >().toEqualTypeOf<Séance>();
  });

  it('Obstacle', () => {
    // `combinaison_ref` (lot 2.5) est nullable en base ⇒ optionnel dans le
    // domaine (`NullToOptional`), fidèle à `Obstacle.combinaison_ref?`.
    expectTypeOf<NullToOptional<typeof obstacle.$inferSelect>>().toEqualTypeOf<Obstacle>();
  });

  it('Combinaison réutilisable', () => {
    // `usage_count` / `last_used_at` sont des colonnes **techniques** (tri
    // anti-bloat, lot 2.5), hors Modèle de données ⇒ exclues de l'alignement
    // avec la forme de domaine (même posture que `idempotency_key` sur `Séance`).
    expectTypeOf<
      NullToOptional<Omit<typeof combinaison.$inferSelect, 'usage_count' | 'last_used_at'>>
    >().toEqualTypeOf<CombinaisonRéutilisable>();
  });

  it('Tour', () => {
    expectTypeOf<NullToOptional<typeof tour.$inferSelect>>().toEqualTypeOf<Tour>();
  });

  it('Contexte', () => {
    expectTypeOf<NullToOptional<typeof contexte.$inferSelect>>().toEqualTypeOf<Contexte>();
  });

  it('Bilan augmenté', () => {
    // Entité **spécifiée au Modèle §3** mais créée seulement en 4.5 (back-doc) :
    // contrairement aux tables techniques (`refresh_token`, `abonnement`), c'est
    // une vraie entité de domaine ⇒ elle est **alignée** sur `@hpt/shared`. Toutes
    // les colonnes sont `NOT NULL` : le domaine `BilanAugmenté` les porte à
    // l'identique (aucune optionnelle).
    expectTypeOf<
      NullToOptional<typeof bilanAugmente.$inferSelect>
    >().toEqualTypeOf<BilanAugmenté>();
  });

  it('Accès invité', () => {
    // Entité **spécifiée au Modèle §3** mais créée seulement en 4.6 (back-doc),
    // comme le Bilan augmenté ⇒ **alignée** sur `@hpt/shared`. `token_hash` est
    // une colonne **technique** (jeton d'invitation hashé, usage unique), hors
    // Modèle de données ⇒ **exclue** de l'alignement (même posture que
    // `idempotency_key` sur `Séance`). `invité_compte_id` est nullable en base
    // (compte relié à l'acceptation) ⇒ optionnel dans le domaine (`NullToOptional`).
    expectTypeOf<
      NullToOptional<Omit<typeof accesInvite.$inferSelect, 'token_hash'>>
    >().toEqualTypeOf<AccèsInvité>();
  });
});
