import { HorseSelector } from '../../horses';
import { Screen } from '../../ui';
import { EmptyState } from '../../ui/EmptyState';
import { ScreenHeader } from '../../ui/ScreenHeader';

/**
 * Onglet **Analytique** (UI/UX §5/§6.5) — placeholder en état vide-invitation.
 * Le diagnostic (heatmap type × hauteur, benchmark) arrive au lot 5.1 ; le
 * gating premium/pro (grisé sinon) est porté plus tard (4.x).
 */
export default function AnalytiqueScreen() {
  return (
    <Screen edges={['left', 'right']} contentStyle={{ flex: 1, padding: 0, gap: 0 }}>
      <ScreenHeader title="Analytique" right={<HorseSelector />} />
      <EmptyState
        icon="stats-chart-outline"
        title="Tes diagnostics apparaîtront ici"
        message="Avec assez de séances, ta heatmap type × hauteur et tes benchmarks révéleront tes points forts."
      />
    </Screen>
  );
}
