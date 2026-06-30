import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../auth';
import { sessionErrorMessage } from '../sessions';
import { clampHauteur } from '../sessions/draft';
import { HeightBar } from '../sessions/height-bar';
import { createSessionsApi } from '../sessions/sessions-api';
import { submitSession } from '../sessions/submit';
import { colors, spacing } from '../theme';
import { Button, Card, Text } from '../ui';
import { buildStartingLineDto } from './starting-line';

export interface StartingLineStepProps {
  chevalId: string;
  /** Hauteur de référence du cheval (point de départ proposé). */
  defaultHauteur: number;
  /** Appelé une fois la ligne de départ posée — le tunnel passe à la séance guidée. */
  onDone: () => void;
}

/**
 * **Question de référence → ligne de départ** (Spec §2.2 étape 2, §2.4) :
 * « Quelle hauteur ton cheval franchit-il proprement aujourd'hui ? ». La réponse
 * crée une **séance `déclaratif`** via le service `sessions` (2.2) — **marquée
 * « antérieure à l'app »** dans le feed (3.1) et **exclue des agrégats** (elle ne
 * compte ni dans la maîtrisée ni dans le record, Modèle §2). C'est un **repère**,
 * pas une performance live.
 *
 * On réutilise la **barre de hauteur** (2.3) et l'**enregistrement résilient**
 * (`submitSession`, idempotence + réessai) — aucun contrat ni endpoint nouveau.
 */
export function StartingLineStep({ chevalId, defaultHauteur, onDone }: StartingLineStepProps) {
  const { client } = useAuth();
  const [hauteur, setHauteur] = useState(() => clampHauteur(defaultHauteur));

  const mutation = useMutation({
    mutationFn: async () => {
      const api = createSessionsApi(client);
      // DTO bâti à l'envoi (clé d'idempotence stable pour ce submit) ; provenance
      // « déclaratif » posée par `buildStartingLineDto`. Réessai sans doublon (2.2).
      return submitSession(api, chevalId, buildStartingLineDto(hauteur));
    },
    onSuccess: onDone,
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="h1">Sa ligne de départ</Text>
        <Text variant="body" color="textMuted">
          Quelle hauteur ton cheval franchit-il proprement aujourd'hui ? On pose ce repère pour voir
          d'où il part.
        </Text>
      </View>

      <Card>
        <HeightBar value={hauteur} onChange={setHauteur} />
      </Card>

      <Card>
        <Text variant="caption" color="textMuted">
          Ce repère est marqué « antérieur à l'app » : il s'affiche dans ton fil mais ne compte ni
          dans la hauteur maîtrisée ni dans les records. Seules tes vraies séances comptent.
        </Text>
      </Card>

      {mutation.isError ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {sessionErrorMessage(mutation.error)}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          label="Poser ma ligne de départ"
          loadingLabel="Enregistrement…"
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  actions: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
