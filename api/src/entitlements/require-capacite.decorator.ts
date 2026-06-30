import type { Capacité } from '@hpt/shared';
import { SetMetadata } from '@nestjs/common';

/** Clé de métadonnée portant la capacité requise par un handler (lue par `EntitlementGuard`). */
export const CAPACITÉ_REQUISE = 'hpt:capacité-requise';

/**
 * Marque un handler (ou un contrôleur entier) comme **réservé** à un tier qui
 * détient `capacité` (lot 4.1). À combiner avec `JwtAccessGuard` +
 * `EntitlementGuard` :
 *
 * ```ts
 * @UseGuards(JwtAccessGuard, EntitlementGuard)
 * @RequireCapacité('analytique_diagnostic')
 * @Get()
 * heatmap() { ... }
 * ```
 *
 * Ici (4.1) la garde est **fournie et prouvée** ; les modules de fonctionnalités
 * payantes (4.4 bilan de progression, 4.5 IA, 4.6 invités, 5.1 analytique)
 * l'**attacheront** sur leurs endpoints. L'UI ne fait que griser (4.2) ; ce
 * décorateur est l'**autorité serveur** (Architecture §5).
 */
export const RequireCapacité = (capacité: Capacité) => SetMetadata(CAPACITÉ_REQUISE, capacité);
