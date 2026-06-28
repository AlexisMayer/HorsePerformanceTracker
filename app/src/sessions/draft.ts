/**
 * Modèle de **brouillon de saisie** et ses opérations pures (lot 2.3, Spec §3,
 * Modèle §6/§7). C'est l'état local de l'écran de saisie : un brouillon que
 * l'utilisateur édite par deltas (chips, slider, compteurs) avant de
 * l'enregistrer via l'API 2.2.
 *
 * **Tout est pur et testable** (aucun import React Native) : le modèle, le
 * réducteur, la projection vers le DTO d'entrée de `@hpt/shared`, la
 * **duplication** (séance précédente / « même obstacle, +5 cm ») et l'**aperçu
 * des taux** (via les fonctions de calcul de `shared` — une seule
 * implémentation, Architecture §2). Les composants ne font que rendre cet état
 * et dispatcher des actions.
 */
import {
  type ContexteCréerDto,
  estCombinaison,
  estConcours,
  HAUTEUR_MAX_CM,
  HAUTEUR_MIN_CM,
  HAUTEUR_PAS_CM,
  type ObstacleCréerDto,
  type Provenance,
  type SéanceCréerDto,
  type SéanceModifierDto,
  type SéanceSortie,
  type TourCréerDto,
  type TypeObstacle,
  type TypeObstacleSimple,
  type TypeSéance,
  tauxCombinaison,
  tauxObstacleSimple,
} from '@hpt/shared';
import { newIdempotencyKey } from './idempotency';

/** Hauteur de départ d'une nouvelle entrée (milieu club/amateur, sur un cran). */
export const DEFAULT_HAUTEUR = 100;
/** Type d'obstacle proposé par défaut à l'ajout. */
export const DEFAULT_TYPE_OBSTACLE: TypeObstacle = 'Vertical';
/** Minimum d'éléments d'une combinaison (cohérent avec le schéma `shared`). */
export const MIN_ÉLÉMENTS = 2;
/** Type proposé par défaut pour un élément de combinaison détaillé à la main. */
export const DEFAULT_TYPE_ÉLÉMENT: TypeObstacleSimple = 'Vertical';
/** Type de séance par défaut à l'ouverture (entraînement à obstacles le plus courant). */
export const DEFAULT_TYPE_SÉANCE: TypeSéance = 'Parcours';

/** Un obstacle en cours d'édition. `localId` sert de clé de liste React (jamais envoyé). */
export interface ObstacleDraft {
  localId: string;
  type: TypeObstacle;
  hauteur: number;
  répétitions: number;
  barres: number;
  refus: number;
  /** Marqueur de difficulté optionnel (couche contexte, jamais agrégé — Modèle §1). */
  difficulté: number | null;
  /** Combinaison : nombre d'éléments (≥ 2, multiplicateur du dénominateur — §7). */
  nombre_d_éléments: number;
  /** Combinaison : détail ordonné des types, saisi à la main (optionnel — 2.5 = bibliothèque). */
  éléments: TypeObstacleSimple[];
}

/** Un tour de concours en cours d'édition (le sans-faute est dérivé, jamais saisi). */
export interface TourDraft {
  localId: string;
  hauteur: number;
  barres: number;
  refus: number;
}

/** Couche contexte optionnelle (hors chemin critique — Spec §3.6, Modèle §1). */
export interface ContexteDraft {
  ressenti_global: number | null;
  énergie: number | null;
  note: string;
}

/** Brouillon complet d'une séance, avec sa clé d'idempotence stable. */
export interface SessionDraft {
  type: TypeSéance;
  obstacles: ObstacleDraft[];
  tours: TourDraft[];
  contexte: ContexteDraft;
  /** Clé d'idempotence (UUID client), fixée à la création — stable sur les réessais. */
  idempotency_key: string;
}

/** Identifiant local unique pour les clés de liste (réutilise le générateur UUID). */
function newLocalId(): string {
  return newIdempotencyKey();
}

/** Ramène une hauteur sur le cran valide le plus proche, bornée [60, 160] (Modèle §0). */
export function clampHauteur(h: number): number {
  const stepped =
    Math.round((h - HAUTEUR_MIN_CM) / HAUTEUR_PAS_CM) * HAUTEUR_PAS_CM + HAUTEUR_MIN_CM;
  return Math.min(HAUTEUR_MAX_CM, Math.max(HAUTEUR_MIN_CM, stepped));
}

/** Monte/descend une hauteur de `deltaSteps` crans de 5 cm, bornée au référentiel. */
export function stepHauteur(h: number, deltaSteps: number): number {
  return clampHauteur(h + deltaSteps * HAUTEUR_PAS_CM);
}

/** Borne un compteur (répétitions, barres, refus, éléments) à un entier ≥ `min`. */
export function clampCounter(value: number, min: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.round(value));
}

/**
 * Ajuste la liste des éléments détaillés d'une combinaison à `n` entrées : on
 * tronque le surplus, on complète avec le type par défaut. Sert quand l'utilisateur
 * détaille (optionnellement) les types/ordre à la main (le détail n'est émis au
 * serveur que s'il est **complet** — cf. `draftToCreateDto`).
 */
export function resizeÉléments(éléments: TypeObstacleSimple[], n: number): TypeObstacleSimple[] {
  const taille = Math.max(0, Math.floor(n));
  const next = éléments.slice(0, taille);
  while (next.length < taille) next.push(DEFAULT_TYPE_ÉLÉMENT);
  return next;
}

/** Crée un obstacle simple par défaut (Vertical, 1 répétition, 0 faute). */
export function newObstacle(overrides: Partial<ObstacleDraft> = {}): ObstacleDraft {
  return {
    localId: newLocalId(),
    type: DEFAULT_TYPE_OBSTACLE,
    hauteur: DEFAULT_HAUTEUR,
    répétitions: 1,
    barres: 0,
    refus: 0,
    difficulté: null,
    nombre_d_éléments: MIN_ÉLÉMENTS,
    éléments: [],
    ...overrides,
  };
}

/** Crée un tour de concours par défaut (0 faute). */
export function newTour(overrides: Partial<TourDraft> = {}): TourDraft {
  return { localId: newLocalId(), hauteur: DEFAULT_HAUTEUR, barres: 0, refus: 0, ...overrides };
}

/** Brouillon vierge, prêt à éditer, avec une clé d'idempotence neuve. */
export function emptyDraft(type: TypeSéance = DEFAULT_TYPE_SÉANCE): SessionDraft {
  return {
    type,
    obstacles: [],
    tours: [],
    contexte: { ressenti_global: null, énergie: null, note: '' },
    idempotency_key: newIdempotencyKey(),
  };
}

/**
 * « **Même obstacle, +5 cm** » (Spec §3.2, UI/UX §6.3/§7) — duplique une entrée
 * en montant la barre d'un cran (bornée à 160). On conserve le **type**, les
 * **répétitions** et, pour une combinaison, sa **structure** (nombre d'éléments
 * + éléments) ; on repart de **0 faute** et sans marqueur de difficulté : c'est
 * une nouvelle tentative, plus haute.
 */
export function duplicateObstaclePlus5(o: ObstacleDraft): ObstacleDraft {
  return newObstacle({
    type: o.type,
    hauteur: stepHauteur(o.hauteur, 1),
    répétitions: o.répétitions,
    nombre_d_éléments: o.nombre_d_éléments,
    éléments: [...o.éléments],
  });
}

/**
 * **Duplication de la séance précédente** (Spec §3.4, boucle nominale) — pré-remplit
 * un brouillon à partir de la dernière séance du cheval : on reprend le **type**
 * et la **structure** (obstacles ou tours, hauteurs, répétitions, structure de
 * combinaison) ; l'utilisateur n'ajuste plus que les **deltas** (typiquement les
 * hauteurs). On repart de **0 faute** (rien n'a encore été monté) et sans
 * contexte (qualitatif, propre à chaque séance). La clé d'idempotence est
 * **neuve** : c'est une nouvelle séance, pas un réessai.
 */
export function draftFromPreviousSession(prev: SéanceSortie): SessionDraft {
  const base = emptyDraft(prev.type);
  if (estConcours(prev.type)) {
    return { ...base, tours: prev.tours.map((t) => newTour({ hauteur: clampHauteur(t.hauteur) })) };
  }
  return {
    ...base,
    obstacles: prev.obstacles.map((o) =>
      newObstacle({
        type: o.type,
        hauteur: clampHauteur(o.hauteur),
        répétitions: clampCounter(o.répétitions, 1),
        nombre_d_éléments: o.nombre_d_éléments ?? MIN_ÉLÉMENTS,
        éléments: (o.éléments ?? []) as TypeObstacleSimple[],
      }),
    ),
  };
}

/**
 * **Pré-remplit un brouillon pour l'ÉDITION** d'une séance existante (lot 2.4,
 * Spec §3.7). À la différence de `draftFromPreviousSession` (qui amorce une
 * *nouvelle* séance, fautes remises à 0), on reprend la séance **à l'identique** :
 * type, collection, **fautes**, marqueurs de difficulté, structure de combinaison
 * **et** contexte — l'utilisateur corrige ce qu'il veut. La `date`, la
 * `provenance` et la clé d'idempotence ne sont **pas éditables** : la clé du
 * brouillon est neuve (inutilisée par le `PATCH`, qui cible la séance par son id).
 */
export function draftFromSession(s: SéanceSortie): SessionDraft {
  const base = emptyDraft(s.type);
  const contexte: ContexteDraft = {
    ressenti_global: s.contexte?.ressenti_global ?? null,
    énergie: s.contexte?.énergie ?? null,
    note: s.contexte?.note ?? '',
  };
  if (estConcours(s.type)) {
    return {
      ...base,
      contexte,
      tours: s.tours.map((t) =>
        newTour({
          hauteur: clampHauteur(t.hauteur),
          barres: clampCounter(t.barres, 0),
          refus: clampCounter(t.refus, 0),
        }),
      ),
    };
  }
  return {
    ...base,
    contexte,
    obstacles: s.obstacles.map((o) =>
      newObstacle({
        type: o.type,
        hauteur: clampHauteur(o.hauteur),
        répétitions: clampCounter(o.répétitions, 1),
        barres: clampCounter(o.barres, 0),
        refus: clampCounter(o.refus, 0),
        difficulté: o.difficulté ?? null,
        nombre_d_éléments: o.nombre_d_éléments ?? MIN_ÉLÉMENTS,
        éléments: (o.éléments ?? []) as TypeObstacleSimple[],
      }),
    ),
  };
}

/**
 * Rend la `date_modification` d'une séance en libellé sobre — **honnêteté
 * d'interface** (UI/UX §7) : on **assume la modification sans dramatiser**. `null`
 * (jamais éditée) ⇒ chaîne vide. Tolérant au transport JSON (la date arrive en
 * chaîne ISO côté app, jamais un objet `Date`).
 */
export function formatDateModification(value: Date | string | null): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const libellé = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `Modifié le ${libellé}`;
}

/**
 * **Aperçu du taux** d'un obstacle, via les fonctions pures de `shared` (Modèle
 * §7) : `(rép − barres − refus)/rép` pour un simple, `(rép × éléments − barres −
 * refus)/(rép × éléments)` pour une combinaison. **Une seule implémentation** —
 * l'aperçu et le calcul serveur ne peuvent pas diverger (Architecture §2).
 * `null` = non calculable (dénominateur nul / entrée incohérente).
 */
export function obstaclePreviewRate(o: ObstacleDraft): number | null {
  if (estCombinaison(o.type)) {
    return tauxCombinaison({
      répétitions: o.répétitions,
      nombre_d_éléments: o.nombre_d_éléments,
      barres: o.barres,
      refus: o.refus,
    });
  }
  return tauxObstacleSimple({ répétitions: o.répétitions, barres: o.barres, refus: o.refus });
}

/** Formate un taux [0,1] en pourcentage entier (« 80 % »), ou « — » si non calculable. */
export function formatRate(rate: number | null): string {
  if (rate == null) return '—';
  return `${Math.round(rate * 100)} %`;
}

/**
 * Le brouillon est-il **enregistrable** ? Un **Plat** l'est toujours (0 obstacle
 * = régularité, Modèle §3) ; un autre entraînement exige ≥ 1 obstacle, un
 * **Concours** ≥ 1 tour (garde de plancher côté client ; le serveur reste
 * l'autorité via Zod).
 */
export function canSave(draft: SessionDraft): boolean {
  if (draft.type === 'Plat') return true;
  if (estConcours(draft.type)) return draft.tours.length > 0;
  return draft.obstacles.length > 0;
}

function obstacleToDto(o: ObstacleDraft): ObstacleCréerDto {
  const base: ObstacleCréerDto = {
    type: o.type,
    hauteur: o.hauteur,
    répétitions: o.répétitions,
    barres: o.barres,
    refus: o.refus,
    ...(o.difficulté != null ? { difficulté: o.difficulté } : {}),
  };
  if (!estCombinaison(o.type)) return base;
  return {
    ...base,
    nombre_d_éléments: o.nombre_d_éléments,
    // Le détail des éléments n'est émis que s'il est **complet** : le serveur
    // exige `éléments.length === nombre_d_éléments`. Incomplet → on l'omet.
    ...(o.éléments.length === o.nombre_d_éléments ? { éléments: o.éléments } : {}),
  };
}

function tourToDto(t: TourDraft): TourCréerDto {
  return { hauteur: t.hauteur, barres: t.barres, refus: t.refus };
}

function contexteToDto(c: ContexteDraft): ContexteCréerDto | undefined {
  const dto: ContexteCréerDto = {};
  if (c.ressenti_global != null) dto.ressenti_global = c.ressenti_global;
  if (c.énergie != null) dto.énergie = c.énergie;
  const note = c.note.trim();
  if (note) dto.note = note;
  return Object.keys(dto).length > 0 ? dto : undefined;
}

/**
 * Projette un brouillon vers le **DTO d'entrée** de l'API 2.2 (`séanceCréerSchema`
 * de `@hpt/shared` — aucun type dupliqué). Le **type pilote la structure** :
 * `Concours` → `tours`, sinon → `obstacles`. La `date` est posée par le serveur
 * (intégrité, Modèle §2). La provenance par défaut est `live` (saisie
 * contemporaine).
 */
export function draftToCreateDto(
  draft: SessionDraft,
  provenance: Provenance = 'live',
): SéanceCréerDto {
  const contexte = contexteToDto(draft.contexte);
  const common = {
    type: draft.type,
    idempotency_key: draft.idempotency_key,
    provenance,
    ...(contexte ? { contexte } : {}),
  };
  if (estConcours(draft.type)) {
    return { ...common, tours: draft.tours.map(tourToDto) };
  }
  return { ...common, obstacles: draft.obstacles.map(obstacleToDto) };
}

/**
 * Projette un brouillon vers le **DTO d'édition** de l'API 2.4
 * (`séanceModifierSchema` de `@hpt/shared` — aucun type dupliqué). Comme la
 * création, **le type pilote la collection** émise (`Concours` → `tours`, sinon
 * `obstacles`) et le contexte n'est émis que s'il porte quelque chose (absent ⇒
 * contexte retiré, remplacement). Ni `idempotency_key` ni `provenance` (immuables)
 * ne sont projetés ; la `date_modification` est posée par le **serveur**, jamais
 * par le client (édition jamais silencieuse, Modèle §2).
 */
export function draftToModifierDto(draft: SessionDraft): SéanceModifierDto {
  const contexte = contexteToDto(draft.contexte);
  const common = {
    type: draft.type,
    ...(contexte ? { contexte } : {}),
  };
  if (estConcours(draft.type)) {
    return { ...common, tours: draft.tours.map(tourToDto) };
  }
  return { ...common, obstacles: draft.obstacles.map(obstacleToDto) };
}

/** Actions du réducteur de brouillon (édition par deltas). */
export type DraftAction =
  | { kind: 'replace'; draft: SessionDraft }
  | { kind: 'setType'; type: TypeSéance }
  | { kind: 'addObstacle'; obstacle?: ObstacleDraft }
  | { kind: 'updateObstacle'; localId: string; patch: Partial<ObstacleDraft> }
  | { kind: 'duplicateObstacle'; localId: string }
  | { kind: 'removeObstacle'; localId: string }
  | { kind: 'addTour'; tour?: TourDraft }
  | { kind: 'updateTour'; localId: string; patch: Partial<TourDraft> }
  | { kind: 'removeTour'; localId: string }
  | { kind: 'updateContexte'; patch: Partial<ContexteDraft> };

function patchById<T extends { localId: string }>(
  items: T[],
  localId: string,
  patch: Partial<T>,
): T[] {
  return items.map((item) => (item.localId === localId ? { ...item, ...patch } : item));
}

/**
 * Réducteur **pur** du brouillon. Changer de type **préserve** les deux
 * collections (un retour en arrière restaure la saisie) ; seule la collection
 * pertinente au type est projetée dans le DTO. La duplication d'obstacle insère
 * le clone **juste après** la source (UI/UX §6.3).
 */
export function draftReducer(draft: SessionDraft, action: DraftAction): SessionDraft {
  switch (action.kind) {
    case 'replace':
      return action.draft;
    case 'setType':
      return { ...draft, type: action.type };
    case 'addObstacle':
      return { ...draft, obstacles: [...draft.obstacles, action.obstacle ?? newObstacle()] };
    case 'updateObstacle':
      return {
        ...draft,
        obstacles: patchById(draft.obstacles, action.localId, action.patch),
      };
    case 'duplicateObstacle': {
      const index = draft.obstacles.findIndex((o) => o.localId === action.localId);
      if (index < 0) return draft;
      const clone = duplicateObstaclePlus5(draft.obstacles[index]);
      const obstacles = [...draft.obstacles];
      obstacles.splice(index + 1, 0, clone);
      return { ...draft, obstacles };
    }
    case 'removeObstacle':
      return { ...draft, obstacles: draft.obstacles.filter((o) => o.localId !== action.localId) };
    case 'addTour':
      return { ...draft, tours: [...draft.tours, action.tour ?? newTour()] };
    case 'updateTour':
      return { ...draft, tours: patchById(draft.tours, action.localId, action.patch) };
    case 'removeTour':
      return { ...draft, tours: draft.tours.filter((t) => t.localId !== action.localId) };
    case 'updateContexte':
      return { ...draft, contexte: { ...draft.contexte, ...action.patch } };
    default:
      return draft;
  }
}
