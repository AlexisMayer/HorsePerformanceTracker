import type { CombinaisonBenchmarkableDto } from '@hpt/shared';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, minTouchTarget, radius, spacing } from '../theme';
import { Card, Text } from '../ui';
import { BenchmarkCurve } from './benchmark-curve';
import { useBenchmarkList, useBenchmarkSérie } from './use-benchmark';

export interface BenchmarkSectionProps {
  chevalId: string | null;
  /** Portée de lecture (lot 4.6) : `/horses` (défaut) ou `/guest-access/horses` (invité). */
  basePath?: string;
}

/**
 * **Section Benchmark à combinaison constante** (lot 5.2, UI/UX §6.5) — placée
 * **sous la heatmap** dans l'écran Analytique. Un **sélecteur** de combinaison
 * réutilisable (instanciée pour ce cheval, triée par usage) + la **courbe de
 * progression** de l'identité choisie (structure figée → la progression est
 * attribuable au **cheval**). **Mono-point** géré (invitation à rejouer) ; **état
 * vide = invitation** (§7). Lecture seule (TanStack Query).
 *
 * Rendu **uniquement en premium/pro** (dans le `children` du `LockedFeature`) ou en
 * **lecture seule scopée invité** (4.6, `basePath`) : un gratuit voit l'aperçu
 * grisé, jamais ceci — et le serveur refuserait la requête (403, autorité 4.1).
 */
export function BenchmarkSection({ chevalId, basePath }: BenchmarkSectionProps) {
  const liste = useBenchmarkList(chevalId, basePath);
  const combinaisons = liste.data?.combinaisons ?? [];

  const [choisi, setChoisi] = useState<string | null>(null);
  // Sélection effective : le choix s'il est toujours dans la liste, sinon la
  // première (la plus travaillée) — jamais un ref périmé.
  const refActif =
    combinaisons.find((c) => c.combinaison_ref === choisi)?.combinaison_ref ??
    combinaisons[0]?.combinaison_ref ??
    null;

  const série = useBenchmarkSérie(chevalId, refActif, basePath);

  return (
    <Card>
      <Text variant="h2">Benchmark à combinaison constante</Text>
      <Text variant="caption" color="textMuted">
        Suis la réussite d’une combinaison enregistrée dans le temps : la structure est figée, la
        progression est celle du cheval.
      </Text>

      {liste.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : liste.isError ? (
        <Text variant="body" color="textMuted">
          Impossible de charger les combinaisons pour le moment. Vérifie ta connexion et réessaie.
        </Text>
      ) : combinaisons.length === 0 ? (
        <Text variant="body" color="textMuted">
          Rejoue une combinaison enregistrée pour suivre sa progression : instancie l’une de tes
          combinaisons réutilisables sur plusieurs séances.
        </Text>
      ) : (
        <View style={styles.body}>
          <CombinaisonSelector
            combinaisons={combinaisons}
            refActif={refActif}
            onChange={setChoisi}
          />
          {série.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : série.isError || !série.data ? (
            <Text variant="body" color="textMuted">
              Impossible de charger la progression pour le moment.
            </Text>
          ) : (
            <BenchmarkCurve série={série.data} />
          )}
        </View>
      )}
    </Card>
  );
}

/**
 * **Sélecteur** de combinaison (chips défilables horizontalement — « Double 1 »,
 * « Triple oxer »…), cibles ≥ 44 px (§8). La combinaison active est en Vert
 * sous-bois ; le décompte d'instanciations (`n_points`) est un indice discret de
 * matière (une combinaison à un seul point est à rejouer).
 */
function CombinaisonSelector({
  combinaisons,
  refActif,
  onChange,
}: {
  combinaisons: CombinaisonBenchmarkableDto[];
  refActif: string | null;
  onChange: (ref: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      accessibilityRole="radiogroup"
    >
      {combinaisons.map((c) => {
        const actif = c.combinaison_ref === refActif;
        return (
          <Pressable
            key={c.combinaison_ref}
            accessibilityRole="radio"
            accessibilityState={{ selected: actif }}
            accessibilityLabel={`${c.nom}, ${c.n_points} instanciation${c.n_points > 1 ? 's' : ''}`}
            onPress={() => onChange(c.combinaison_ref)}
            style={[styles.chip, actif && styles.chipActif]}
          >
            <Text variant="label" style={{ color: actif ? colors.onPrimary : colors.text }}>
              {c.nom}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.md,
  },
  center: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  chips: {
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  chip: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActif: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
