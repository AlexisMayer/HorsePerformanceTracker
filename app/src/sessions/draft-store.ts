import type { SecureStorageBackend } from '../auth/token-store';
import type { SessionDraft } from './draft';

/**
 * **Brouillon local** persistant (lot 2.3, Stack §4 — « qualité de plancher »).
 * La saisie en cours est mirroir sur le stockage de l'appareil, **scopée au
 * cheval**, pour qu'une fermeture de l'app (ou un crash) **ne perde jamais une
 * saisie**. Le brouillon est effacé à l'enregistrement réussi.
 *
 * Le backend est **injecté** (même interface étroite que le store de jetons de
 * 1.4) : la prod passe `expo-secure-store`, les tests un faux en mémoire — la
 * logique reste testable sans dépendance native. JSON corrompu ou de forme
 * inattendue → on renvoie `null` (jamais de plantage : un brouillon illisible ne
 * doit pas bloquer la saisie).
 */
export interface DraftStore {
  load(chevalId: string): Promise<SessionDraft | null>;
  save(chevalId: string, draft: SessionDraft): Promise<void>;
  clear(chevalId: string): Promise<void>;
}

/** Préfixe de clé (namespacé par cheval pour éviter les collisions). */
export const DRAFT_KEY_PREFIX = 'hpt.session_draft.';

function draftKey(chevalId: string): string {
  return `${DRAFT_KEY_PREFIX}${chevalId}`;
}

/** Garde de forme minimale d'un brouillon désérialisé (tolérante, non bloquante). */
function isSessionDraft(value: unknown): value is SessionDraft {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.type === 'string' &&
    typeof v.idempotency_key === 'string' &&
    Array.isArray(v.obstacles) &&
    Array.isArray(v.tours) &&
    typeof v.contexte === 'object' &&
    v.contexte !== null
  );
}

export function createDraftStore(backend: SecureStorageBackend): DraftStore {
  return {
    load: async (chevalId) => {
      const raw = await backend.getItemAsync(draftKey(chevalId));
      if (!raw) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        return isSessionDraft(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    save: (chevalId, draft) => backend.setItemAsync(draftKey(chevalId), JSON.stringify(draft)),
    clear: (chevalId) => backend.deleteItemAsync(draftKey(chevalId)),
  };
}
