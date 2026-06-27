import { Screen } from '../../ui';
import { EmptyState } from '../../ui/EmptyState';
import { ScreenHeader } from '../../ui/ScreenHeader';

/**
 * Onglet **Historique** (UI/UX §5/§6.4) — placeholder en état vide-invitation.
 * La liste des séances passées et l'accès à leurs bilans arrivent au lot 3.4.
 */
export default function HistoriqueScreen() {
  return (
    <Screen edges={['left', 'right']} contentStyle={{ flex: 1, padding: 0, gap: 0 }}>
      <ScreenHeader title="Historique" horseSelectorPlaceholder />
      <EmptyState
        icon="time-outline"
        title="Tes séances s'archivent ici"
        message="Chaque séance enregistrée rejoindra ton historique, avec son bilan à rouvrir quand tu veux."
      />
    </Screen>
  );
}
