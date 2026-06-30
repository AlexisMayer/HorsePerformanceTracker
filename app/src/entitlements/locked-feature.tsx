import type { Capacité } from '@hpt/shared';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { LockedOverlay } from '../ui';
import { useEntitlement } from './entitlements-context';

export interface LockedFeatureProps {
  /** Capacité gatée requise (clé de la matrice 4.1, ex. `analytique_diagnostic`). */
  capacité: Capacité;
  /** Titre affiché sur l'état verrouillé. */
  titre: string;
  /** Aperçu **grisé** montré quand c'est verrouillé (sous le voile + cadenas). */
  aperçu: ReactNode;
  /** Contenu **réel**, rendu uniquement quand la capacité est débloquée. */
  children: ReactNode;
}

/**
 * **Slot de fonction verrouillée** (lot 4.2) — le point de réutilisation pour les
 * fonctions payantes (analytique 5.1, bilans 4.4/4.5, invités 4.6). Lit
 * l'entitlement (4.1, **autorité serveur** — l'app ne fait que griser) :
 *
 *  - **capacité débloquée** → rend le **contenu réel** (`children`) ;
 *  - sinon → rend l'**aperçu grisé** sous un `LockedOverlay` (voile + cadenas)
 *    dont l'appui **ouvre l'upgrade** (verrouillage = invitation, §7), en
 *    passant la capacité au paywall (qui en déduit le tier à proposer).
 *
 * Tant que l'entitlement charge, on reste **prudemment verrouillé** (pas de
 * flash du contenu réel) — le serveur reste la vérité.
 */
export function LockedFeature({ capacité, titre, aperçu, children }: LockedFeatureProps) {
  const { entitlement } = useEntitlement();
  const router = useRouter();
  const débloqué = entitlement?.capacités?.[capacité] ?? false;

  if (débloqué) {
    return <>{children}</>;
  }

  return (
    <LockedOverlay
      titre={titre}
      onUpgrade={() => router.push({ pathname: '/upgrade', params: { cap: capacité } })}
    >
      {aperçu}
    </LockedOverlay>
  );
}
