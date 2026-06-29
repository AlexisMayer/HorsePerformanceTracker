import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme';
import { MasteryHero } from './mastery-hero';
import { RecordsVitrine } from './records-vitrine';
import { useMetrics } from './use-metrics';

export interface MetricsHeroProps {
  chevalId: string | null;
}

/**
 * **Bloc héros** en haut de l'onglet Feed (UI/UX §6.2, Spec §5.2) — **exactement
 * deux surfaces** : la **courbe de hauteur maîtrisée** (+ grand chiffre) et la
 * **vitrine à records/jalons**, posées **au-dessus** du fil (3.1, livré). Les
 * héros sont **gratuits**, **jamais verrouillés** (le gating 4.1 ne les touche
 * pas).
 *
 * Discret par construction : tant qu'il n'y a **rien à montrer** (pas encore de
 * franchissement propre — séances vides, Plat seul, ou cheval non choisi), le bloc
 * **ne rend rien** et laisse l'invitation du fil opérer (§7). Dès qu'un record ou
 * une maîtrise existe, les héros apparaissent.
 */
export function MetricsHero({ chevalId }: MetricsHeroProps) {
  const { data } = useMetrics(chevalId);
  if (!data) return null;

  const aDesHéros =
    data.maîtrise.courante !== null ||
    data.maîtrise.record !== null ||
    data.vitrine.jalons.length > 0;
  if (!aDesHéros) return null;

  return (
    <View style={styles.container}>
      <MasteryHero maîtrise={data.maîtrise} />
      <RecordsVitrine vitrine={data.vitrine} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
});
