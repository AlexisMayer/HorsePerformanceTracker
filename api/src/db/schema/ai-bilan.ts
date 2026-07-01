import { pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { champsTechniques } from './champs-techniques';
import { seance } from './seance';

/**
 * **Bilan augmenté** (assistant IA — lot 4.5, Modèle §3). L'entité est
 * **spécifiée au Modèle de données** (§3) mais **n'avait pas été créée en 0.3**
 * (6 entités socle) : 4.5 ajoute sa table par **migration Drizzle additive** et
 * la **back-documente** (cf. journal — écart signalé). Contrairement aux tables
 * purement techniques (`refresh_token`, `abonnement`), c'est une **vraie entité
 * de domaine** → elle est **alignée** sur `@hpt/shared` (`alignment.spec.ts`).
 *
 * Un bilan augmenté est un **texte consultatif** (Modèle §1), **jamais une
 * métrique** : il ne nourrit aucune courbe ni agrégat. Persisté, il est **relu
 * sans régénération** (Spec §7.3).
 *
 * - `seance_id` → `seance`, **`ON DELETE CASCADE`** (cohérent avec la cascade
 *   descendante du socle 0.3 et la purge RGPD 1.3 : supprimer une séance emporte
 *   son bilan). **`UNIQUE(seance_id)`** : **un seul** bilan augmenté par séance —
 *   la génération est un *get-or-create* (relu sans nouvel appel IA, garde-fou de
 *   coût, Stack §3.6).
 * - `date_génération` : date métier de génération (distincte des horodatages
 *   techniques ; colonne `date_generation` en ASCII, comme `seance.date`).
 * - `modèle` / `version` : le modèle Mistral **épinglé** utilisé (jamais
 *   `-latest`, Stack §3.6) — tracés pour l'auditabilité (colonnes `modele` /
 *   `version`).
 * - `analyse` / `recommandations` : le **contenu** (bilan de la dernière séance +
 *   recommandations pour la prochaine, Modèle §3).
 */
export const bilanAugmente = pgTable(
  'bilan_augmente',
  {
    ...champsTechniques,
    seance_id: uuid('seance_id')
      .notNull()
      .references(() => seance.id, { onDelete: 'cascade' }),
    date_génération: timestamp('date_generation', { withTimezone: true, mode: 'date' }).notNull(),
    modèle: text('modele').notNull(),
    version: text('version').notNull(),
    analyse: text('analyse').notNull(),
    recommandations: text('recommandations').notNull(),
  },
  (t) => [unique('bilan_augmente_seance_unique').on(t.seance_id)],
);
