import type { ChevalSortie } from '@hpt/shared';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { horseErrorMessage, useHorses } from '../../horses';
import { colors, spacing } from '../../theme';
import { BackHeader, Badge, Button, Card, Screen, Text } from '../../ui';

const NIVEAU_LABELS: Record<ChevalSortie['niveau'], string> = {
  amateur: 'Amateur',
  pro: 'Pro',
};

/**
 * Écran **Mes chevaux** (Spec §9.2) — liste les chevaux du compte et ouvre la
 * création / l'édition. En v1 mono-cheval, un seul cheval suffit, mais la liste
 * est posée proprement (le multi-cheval réel est Pro, lot 4.x). Vide = invitation
 * (UI/UX §7).
 */
export default function HorsesListScreen() {
  const { horses, isLoading, error, refetch } = useHorses();
  const router = useRouter();

  return (
    <Screen scroll edges={['top', 'left', 'right']} contentStyle={styles.content}>
      <BackHeader title="Mes chevaux" onBack={() => router.back()} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <Card>
          <Text variant="bodyStrong">Chargement impossible</Text>
          <Text variant="body" color="textMuted">
            {horseErrorMessage(error)}
          </Text>
          <Button variant="secondary" label="Réessayer" onPress={refetch} />
        </Card>
      ) : horses.length === 0 ? (
        <Card>
          <Text variant="h2">Ajoute ton premier cheval</Text>
          <Text variant="body" color="textMuted">
            Sa fiche ouvre le suivi : dès ta première séance, sa progression s'affichera dans ton
            fil.
          </Text>
        </Card>
      ) : (
        horses.map((horse) => (
          <Pressable
            key={horse.id}
            accessibilityRole="button"
            accessibilityLabel={`Modifier ${horse.nom}`}
            onPress={() => router.push(`/horses/${horse.id}`)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Card>
              <View style={styles.row}>
                <Text variant="h2" numberOfLines={1} style={styles.name}>
                  {horse.nom}
                </Text>
                <Badge label={NIVEAU_LABELS[horse.niveau]} tone="neutral" />
              </View>
              <Text variant="body" color="textMuted">
                Hauteur de référence : {horse.hauteur_de_référence} cm
                {horse.race ? ` · ${horse.race}` : ''}
              </Text>
            </Card>
          </Pressable>
        ))
      )}

      <Button label="Ajouter un cheval" onPress={() => router.push('/horses/new')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
  center: {
    paddingVertical: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
