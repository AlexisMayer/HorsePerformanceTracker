import type { SéanceCréerDto, SéanceSortie } from '@hpt/shared';
import { ApiError } from '../auth/api-client';
import type { SessionsApi } from './sessions-api';

/**
 * **Enregistrement résilient** d'une séance (lot 2.3, Stack §4) : on rejoue la
 * **même** requête (donc le **même `idempotency_key`**) sur une coupure
 * passagère, avec attente exponentielle. Comme le serveur (2.2) dédoublonne sur
 * `(cheval_id, idempotency_key)`, un réessai **ne crée jamais de doublon** :
 * si le premier essai a en fait écrit avant que la réponse ne se perde, le
 * réessai renvoie la séance déjà créée.
 *
 * On ne réessaie que les erreurs **transitoires** (réseau, 5xx, 408, 429) ; une
 * erreur définitive (400 = saisie invalide, 401 = session tombée, 404 = cheval
 * absent) remonte tout de suite — réessayer n'y changerait rien. Le 401 est de
 * toute façon déjà intercepté en amont (refresh + rejeu, 1.4).
 *
 * Module **pur et injectable** (`delay`, `isTransient`) : testable en Node, sans
 * minuteur réel ni réseau.
 */
export interface SubmitOptions {
  /** Réessais après le 1er essai (défaut 3 → 4 tentatives au total). */
  retries?: number;
  /** Délai de base de l'attente exponentielle, en ms (défaut 500). */
  baseDelayMs?: number;
  /** Attente injectable (tests). Défaut : `setTimeout`. */
  delay?: (ms: number) => Promise<void>;
  /** Classement « transitoire ? » injectable (tests). Défaut : `isTransientError`. */
  isTransient?: (error: unknown) => boolean;
  /** Notifié avant chaque réessai (UI : « Réessai… »). */
  onRetry?: (attempt: number, error: unknown) => void;
}

const defaultDelay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Une erreur est-elle **transitoire** (donc réessayable) ? */
export function isTransientError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return (
      error.status >= 500 || error.status === 408 || error.status === 429 || error.status === 0
    );
  }
  // Échec réseau de `fetch` → `TypeError` (« Network request failed »).
  if (error instanceof TypeError) return true;
  return false;
}

/**
 * Envoie la séance et **réessaie** les coupures passagères en réutilisant le même
 * DTO (clé d'idempotence stable). Renvoie la séance créée, ou lève la dernière
 * erreur si elle est définitive ou si les réessais sont épuisés.
 */
export async function submitSession(
  api: SessionsApi,
  chevalId: string,
  dto: SéanceCréerDto,
  options: SubmitOptions = {},
): Promise<SéanceSortie> {
  const {
    retries = 3,
    baseDelayMs = 500,
    delay = defaultDelay,
    isTransient = isTransientError,
    onRetry,
  } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await api.create(chevalId, dto);
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isTransient(error)) throw error;
      onRetry?.(attempt + 1, error);
      await delay(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError; // inatteignable : la boucle renvoie ou lève toujours.
}
