/**
 * **Tendance** — vocabulaire dérivé (fermé) du **sens d'une trajectoire** dans le
 * temps : `hausse` / `stable` / `baisse`. Comme `TYPES_JALON`, ce n'est pas une
 * donnée saisie mais une **sortie de calcul** ; il est **figé et partagé** par les
 * surfaces d'analytique qui l'exposent — le **bilan de progression** (trajectoire
 * de maîtrise, lot 4.4) **et** le **benchmark à combinaison constante** (lot 5.2).
 *
 * Source unique (Architecture §2) : le tuple ci-dessous alimente le type **et** le
 * schéma Zod (`tendanceSchema`, `schemas/referentiel`) — jamais redéclaré.
 */
export const TENDANCES = ['hausse', 'stable', 'baisse'] as const;

export type Tendance = (typeof TENDANCES)[number];
