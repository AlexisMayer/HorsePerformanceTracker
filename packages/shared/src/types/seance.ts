import type { Provenance, TypeSéance } from '../enums/seance';
import type { ChampsTechniques } from './champs-techniques';

/**
 * Séance (Modèle §3/§5). Collection d'obstacles (entraînement) ou de tours
 * (concours) — les unités atomiques pointent vers la séance par `seance_id`,
 * elles ne sont pas imbriquées dans cette forme de domaine normalisée
 * (les formes imbriquées vivent dans les DTO, cf. `schemas/seance.ts`).
 *
 * `date` est la date métier immuable ; `date_modification` n'est posée que si
 * une séance ancienne est éditée (intégrité, §2). `provenance` distingue la
 * trace contemporaine de l'amorçage déclaratif.
 */
export interface Séance extends ChampsTechniques {
  cheval_id: string;
  type: TypeSéance;
  date: Date;
  date_modification?: Date;
  provenance: Provenance;
}
