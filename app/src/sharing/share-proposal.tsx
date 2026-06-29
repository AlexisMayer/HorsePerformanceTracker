import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme';
import { Button, Card, Text } from '../ui';
import { BilanCard } from './bilan-card';
import { useShareCard } from './use-share-card';

export interface ShareProposalProps {
  seanceId: string;
  nomCheval: string;
  /** Referme la proposition **sans friction** (`[ Plus tard ]`) — jamais imposée. */
  onDismiss: () => void;
}

/**
 * **Proposition de carte partageable** (UI/UX §7 « enregistrer → célébrer »,
 * §6.6) — greffée **par-dessus** la confirmation « Enregistré » de 2.3, sans la
 * remplacer. Non intrusive : un **aperçu de la carte** + `[ Partager ] / [ Plus
 * tard ]`. `[ Partager ]` capture la carte et ouvre la feuille de partage native ;
 * `[ Plus tard ]` referme **sans friction** (pas de lassitude, Spec §5.4).
 *
 * Gratuite, **jamais verrouillée** (carte de séance simple, tous comptes — §8) :
 * aucun gating ici. Si la carte n'est pas (encore) disponible, `[ Plus tard ]`
 * reste possible — l'utilisateur n'est jamais bloqué.
 */
export function ShareProposal({ seanceId, nomCheval, onDismiss }: ShareProposalProps) {
  const { carte, loading, cardRef, partager, sharing } = useShareCard(seanceId, nomCheval);

  return (
    <View style={styles.wrap}>
      {carte ? (
        <BilanCard ref={cardRef} carte={carte} nomCheval={nomCheval} />
      ) : (
        <Card>
          <Text variant="body" color="textMuted">
            {loading ? 'Préparation de ta carte…' : 'Carte indisponible pour le moment.'}
          </Text>
        </Card>
      )}

      <Button
        label="Partager"
        loadingLabel="Partage…"
        loading={sharing}
        disabled={!carte}
        onPress={() => {
          void partager();
        }}
      />
      <Button label="Plus tard" variant="ghost" onPress={onDismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
});
