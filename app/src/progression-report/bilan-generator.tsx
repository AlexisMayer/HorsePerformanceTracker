import { Ionicons } from '@expo/vector-icons';
import type { BilanProgression, IndicateursBilan } from '@hpt/shared';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { colors, minTouchTarget, radius, spacing } from '../theme';
import { Button, Card, SegmentedControl, StatText, Text } from '../ui';
import {
  PÉRIODE_PRESET_LABELS,
  PÉRIODE_PRESETS,
  type PériodePreset,
  périodePourPreset,
} from './period-presets';
import { useGénérerBilan } from './use-progression-report';

/** Ordre + libellés des indicateurs curables (§6.3). identité/période sont fixes. */
const INDICATEURS: { clé: keyof IndicateursBilan; label: string }[] = [
  { clé: 'niveau_démontré', label: 'Niveau démontré' },
  { clé: 'performance_concours', label: 'Performance concours' },
  { clé: 'régularité', label: 'Régularité & suivi' },
  { clé: 'trajectoire', label: 'Trajectoire' },
];

const TENDANCE_LABEL: Record<string, string> = {
  hausse: '↗ En progression',
  stable: '→ Stable',
  baisse: '↘ En repli',
};

const TOUS_ACTIFS: IndicateursBilan = {
  niveau_démontré: true,
  performance_concours: true,
  régularité: true,
  trajectoire: true,
};

/**
 * **Écran de génération du bilan de progression** (lot 4.4, tranche front,
 * UI/UX §1/§8). Le coach choisit la **période** et les **indicateurs** (curation
 * §6.3), déclenche la génération, puis récupère le **PDF/lien**. Ton **pro,
 * sobre** : c'est un **livrable client**, pas un écran de vente. Cibles ≥ 44 px,
 * chiffres tabulaires (§8).
 *
 * La **curation ne touche pas la donnée** : elle ne fait que cadrer le rapport
 * (le serveur reste l'autorité, la donnée reste inviolable §2/§6.3).
 */
export function BilanGenerator({ chevalId, chevalNom }: { chevalId: string; chevalNom: string }) {
  const [preset, setPreset] = useState<PériodePreset>('tout');
  const [format, setFormat] = useState<'lien' | 'pdf'>('lien');
  const [indicateurs, setIndicateurs] = useState<IndicateursBilan>(TOUS_ACTIFS);
  const bilan = useGénérerBilan(chevalId);

  const toggle = (clé: keyof IndicateursBilan) =>
    setIndicateurs((prev) => ({ ...prev, [clé]: !prev[clé] }));

  const générer = () => {
    bilan.mutate({
      période: périodePourPreset(preset, new Date()),
      indicateurs,
      format,
    });
  };

  return (
    <View style={styles.container}>
      <Text variant="body" color="textMuted">
        Un livrable soigné, pour {chevalNom}, à remettre à ton client — même sans l'app. Bâti sur
        les faits objectifs et les séances vérifiées.
      </Text>

      <Card>
        <SegmentedControl
          label="Période"
          options={PÉRIODE_PRESETS.map((p) => ({ value: p, label: PÉRIODE_PRESET_LABELS[p] }))}
          value={preset}
          onChange={setPreset}
        />
      </Card>

      <Card>
        <Text variant="label" color="textMuted">
          Indicateurs présentés
        </Text>
        <View style={styles.toggles}>
          {INDICATEURS.map(({ clé, label }) => (
            <IndicateurToggle
              key={clé}
              label={label}
              actif={indicateurs[clé]}
              onToggle={() => toggle(clé)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <SegmentedControl
          label="Format"
          options={[
            { value: 'lien', label: 'Lien web' },
            { value: 'pdf', label: 'PDF' },
          ]}
          value={format}
          onChange={setFormat}
        />
      </Card>

      <Button
        label="Générer le bilan"
        loadingLabel="Génération…"
        loading={bilan.isPending}
        onPress={générer}
      />

      {bilan.error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          Impossible de générer le bilan pour le moment. Réessaie dans un instant.
        </Text>
      ) : null}

      {bilan.data ? <BilanRésultat bilan={bilan.data} /> : null}
    </View>
  );
}

/** Ligne d'indicateur activable (case à cocher accessible, cible ≥ 44 px). */
function IndicateurToggle({
  label,
  actif,
  onToggle,
}: {
  label: string;
  actif: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: actif }}
      accessibilityLabel={label}
      onPress={onToggle}
      style={styles.toggleRow}
    >
      <View style={[styles.checkbox, actif && styles.checkboxOn]}>
        {actif ? <Ionicons name="checkmark" size={16} color={colors.onPrimary} /> : null}
      </View>
      <Text variant="body">{label}</Text>
    </Pressable>
  );
}

/**
 * **Résultat** de génération : un aperçu chiffré **soigné** des sections + le lien
 * vers l'artefact (à ouvrir/partager). En dev, le PDF est un **stub** (le lien web
 * fait foi) — signalé honnêtement.
 */
function BilanRésultat({ bilan }: { bilan: BilanProgression }) {
  const { sections } = bilan;
  const ouvrir = () => WebBrowser.openBrowserAsync(bilan.artefact.url).catch(() => {});
  const partager = () =>
    Share.share({ message: bilan.artefact.url, url: bilan.artefact.url }).catch(() => {});

  return (
    <Card style={styles.result}>
      <View style={styles.resultHead}>
        <Ionicons name="document-text" size={22} color={colors.primary} />
        <Text variant="h2">Bilan prêt</Text>
      </View>

      <Text variant="caption" color="textMuted">
        {sections.période.nb_séances} séance{sections.période.nb_séances > 1 ? 's' : ''} sur la
        période retenue
      </Text>

      <View style={styles.stats}>
        {sections.niveau_démontré ? (
          <View style={styles.stat}>
            <StatText>
              {sections.niveau_démontré.hauteur_maîtrisée == null
                ? '—'
                : `${sections.niveau_démontré.hauteur_maîtrisée} cm`}
            </StatText>
            <Text variant="caption" color="textMuted">
              Maîtrisée
            </Text>
          </View>
        ) : null}
        {sections.régularité ? (
          <View style={styles.stat}>
            <StatText>{sections.régularité.total_séances}</StatText>
            <Text variant="caption" color="textMuted">
              Séances
            </Text>
          </View>
        ) : null}
        {sections.trajectoire?.tendance ? (
          <View style={styles.stat}>
            <Text variant="bodyStrong">{TENDANCE_LABEL[sections.trajectoire.tendance]}</Text>
            <Text variant="caption" color="textMuted">
              Trajectoire
            </Text>
          </View>
        ) : null}
      </View>

      {bilan.artefact.stub ? (
        <Text variant="caption" color="textMuted">
          Aperçu PDF (généré localement en dev) — le lien web ci-dessous est le livrable.
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button label="Ouvrir le bilan" onPress={ouvrir} />
        <Button variant="secondary" label="Partager le lien" onPress={partager} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  toggles: { gap: spacing.xs, marginTop: spacing.xs },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm - 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  result: { gap: spacing.sm, borderColor: colors.primary },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.xxs },
  stat: { gap: spacing.xxs },
  actions: { gap: spacing.xs, marginTop: spacing.xs },
});
