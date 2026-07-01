import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { LockedFeature } from '../entitlements';
import { useHorses } from '../horses';
import { BilanApercu, BilanGenerator } from '../progression-report';
import { spacing } from '../theme';
import { BackHeader, Button, Card, EmptyState, Screen, Text } from '../ui';

/**
 * Écran **Bilan de progression** (lot 4.4, route `/progression-report`). Le
 * **vrai générateur** (Spec §6) : curation période/indicateurs → PDF/lien, pour le
 * cheval **courant** (mono-cheval en premium ; un rapport par cheval en pro).
 *
 * **Gating (§8/§9.4)** : `LockedFeature` (verrou 4.2) lit l'entitlement (autorité
 * serveur 4.1). En **gratuit**, le générateur est **grisé + cadenas** (aperçu du
 * livrable) et l'appui ouvre l'upgrade vers **premium** ; en **premium/pro**, le
 * générateur réel s'affiche. Le serveur reste la vérité (403 côté API).
 */
export default function ProgressionReportScreen() {
  const router = useRouter();
  const { currentHorse } = useHorses();

  return (
    <Screen scroll edges={['top', 'left', 'right']} contentStyle={styles.content}>
      <BackHeader title="Bilan de progression" onBack={() => router.back()} />

      {currentHorse ? (
        <LockedFeature
          capacité="bilan_progression"
          titre="Bilan de progression"
          aperçu={<BilanApercu />}
        >
          <BilanGenerator chevalId={currentHorse.id} chevalNom={currentHorse.nom} />
        </LockedFeature>
      ) : (
        <Card>
          <EmptyState
            icon="document-text-outline"
            title="Aucun cheval à documenter"
            message="Ajoute un cheval et logue quelques séances : ton bilan de progression se construira sur ces faits."
          />
          <Button label="Ajouter un cheval" onPress={() => router.push('/horses/new')} />
        </Card>
      )}

      <Text variant="caption" color="textMuted">
        Le bilan n'utilise que les faits objectifs et les séances vérifiées — jamais tes notes ni
        ton ressenti privés.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
});
