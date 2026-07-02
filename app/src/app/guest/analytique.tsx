import { AnalytiqueContenu } from '../../analytics';
import { GUEST_READ_BASE, useGuestAccess } from '../../guest-access';
import { Screen } from '../../ui';

/**
 * **Analytique invité** (lot 4.6, UI/UX §6.7, Spec §9.5) — le diagnostic du
 * **cheval partagé** : heatmap (5.1) **et** benchmark à combinaison constante
 * (5.2). Réutilise `AnalytiqueContenu` via le `basePath` invité (`read-scope`) —
 * **sans** `LockedFeature` : l'invité voit l'analytique **par l'octroi** (le
 * propriétaire est Pro, la donnée existe), **pas** par son propre tier (il n'est
 * pas gaté `analytique_diagnostic` — le serveur autorise via la portée invité).
 * Lecture seule ; aucune surface n'est reconstruite (Architecture §2/§3).
 */
export default function GuestAnalytiqueScreen() {
  const { sharedHorses } = useGuestAccess();
  const chevalId = sharedHorses[0]?.cheval_id ?? null;

  return (
    <Screen edges={['left', 'right']} contentStyle={{ flex: 1, padding: 0, gap: 0 }}>
      <AnalytiqueContenu chevalId={chevalId} basePath={GUEST_READ_BASE} />
    </Screen>
  );
}
