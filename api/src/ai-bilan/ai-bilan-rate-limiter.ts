import type { AiBilanConfig } from './ai-bilan.config';

/**
 * **Rate limiter par utilisateur** du module `ai-bilan` (lot 4.5, Stack §3.6 —
 * « rate limiting par utilisateur + garde-fous de coût »). Fenêtre glissante
 * en mémoire : au plus `rateLimitMax` **générations** (appels IA effectifs) par
 * compte sur `rateLimitFenêtreMs`. Une **relecture** ne consomme rien (la
 * génération est un *get-or-create*) — seul un **nouvel** appel Mistral compte,
 * ce qui borne le coût sans pénaliser la relecture (Spec §7.3).
 *
 * In-memory, **suffisant pour un usager seul** (même posture que le décompte de
 * quota 4.1) ; un backend partagé (Redis) reste possible plus tard si plusieurs
 * instances d'API tournent — point ouvert au journal. L'horloge est
 * **injectable** pour des tests déterministes (construit via `useFactory`, donc
 * le second paramètre n'est pas résolu par le conteneur Nest).
 */
export class AiBilanRateLimiter {
  /** Horodatages (ms) des générations récentes, par compte. */
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly config: AiBilanConfig,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /**
   * Tente de **consommer** une génération pour `compteId`. Purge d'abord les
   * hits hors fenêtre, puis autorise si le compte est sous le plafond (auquel
   * cas l'appel est enregistré). Renvoie `false` si le plafond est atteint —
   * le service traduit alors en **429** (`BilanAugmentéRateLimitError`).
   */
  consume(compteId: string): boolean {
    const maintenant = this.now();
    const début = maintenant - this.config.rateLimitFenêtreMs;
    const récents = (this.hits.get(compteId) ?? []).filter((t) => t > début);

    if (récents.length >= this.config.rateLimitMax) {
      // On réécrit la liste purgée même en cas de refus (évite une fuite mémoire).
      this.hits.set(compteId, récents);
      return false;
    }

    récents.push(maintenant);
    this.hits.set(compteId, récents);
    return true;
  }
}
