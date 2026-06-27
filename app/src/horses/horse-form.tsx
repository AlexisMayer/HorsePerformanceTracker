import { estHauteurValide, HAUTEUR_MAX_CM, HAUTEUR_MIN_CM, type NiveauCheval } from '@hpt/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme';
import { Button, SegmentedControl, Text, TextField } from '../ui';

/** Valeurs normalisées émises par le formulaire (`null` = champ facultatif vide). */
export interface HorseFormSubmit {
  nom: string;
  niveau: NiveauCheval;
  hauteur_de_référence: number;
  âge: number | null;
  race: string | null;
}

export interface HorseFormInitial {
  nom?: string;
  niveau?: NiveauCheval;
  hauteur_de_référence?: number | null;
  âge?: number | null;
  race?: string | null;
}

export interface HorseFormProps {
  initial?: HorseFormInitial;
  submitLabel: string;
  submitLoadingLabel: string;
  loading?: boolean;
  /** Message d'erreur serveur (mutation) à afficher au-dessus du bouton. */
  error?: string;
  onSubmit: (values: HorseFormSubmit) => void;
}

const NIVEAU_OPTIONS: readonly { value: NiveauCheval; label: string }[] = [
  { value: 'amateur', label: 'Amateur' },
  { value: 'pro', label: 'Pro' },
];

/**
 * Formulaire de fiche cheval (UI/UX §6.1, §8) — partagé par la création et
 * l'édition (lot 2.1). Formulaire **minimal** : `nom` + `niveau` +
 * `hauteur_de_référence` requis (cohérent avec l'onboarding amateur, Spec §2.2),
 * `âge`/`race` facultatifs. Le **slider de hauteur** dédié arrive avec la saisie
 * (2.x) ; ici un champ numérique validé sur le référentiel §0 suffit.
 *
 * Validation de plancher côté client (message « de son côté de l'écran ») ; le
 * serveur reste l'**autorité** (frontière Zod du module `horses`).
 */
export function HorseForm({
  initial,
  submitLabel,
  submitLoadingLabel,
  loading = false,
  error,
  onSubmit,
}: HorseFormProps) {
  const [nom, setNom] = useState(initial?.nom ?? '');
  const [niveau, setNiveau] = useState<NiveauCheval>(initial?.niveau ?? 'amateur');
  const [hauteur, setHauteur] = useState(
    initial?.hauteur_de_référence != null ? String(initial.hauteur_de_référence) : '',
  );
  const [âge, setÂge] = useState(initial?.âge != null ? String(initial.âge) : '');
  const [race, setRace] = useState(initial?.race ?? '');
  const [fieldErrors, setFieldErrors] = useState<{ nom?: string; hauteur?: string; âge?: string }>(
    {},
  );

  const handleSubmit = () => {
    const errors: { nom?: string; hauteur?: string; âge?: string } = {};

    const nomClean = nom.trim();
    if (!nomClean) errors.nom = 'Donne un nom à ton cheval.';

    const hauteurNum = Number(hauteur);
    if (!hauteur.trim() || !Number.isInteger(hauteurNum) || !estHauteurValide(hauteurNum)) {
      errors.hauteur = `Entre ${HAUTEUR_MIN_CM} et ${HAUTEUR_MAX_CM} cm, par pas de 5.`;
    }

    const âgeClean = âge.trim();
    let âgeNum: number | null = null;
    if (âgeClean) {
      âgeNum = Number(âgeClean);
      if (!Number.isInteger(âgeNum) || âgeNum <= 0 || âgeNum > 60) {
        errors.âge = 'Âge invalide.';
      }
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit({
      nom: nomClean,
      niveau,
      hauteur_de_référence: hauteurNum,
      âge: âgeNum,
      race: race.trim() || null,
    });
  };

  return (
    <View style={styles.form}>
      <TextField
        label="Nom"
        value={nom}
        onChangeText={setNom}
        autoCapitalize="words"
        placeholder="Le nom de ton cheval"
        error={fieldErrors.nom}
      />

      <SegmentedControl
        label="Niveau de compétition"
        options={NIVEAU_OPTIONS}
        value={niveau}
        onChange={setNiveau}
      />

      <TextField
        label="Hauteur de référence (cm)"
        value={hauteur}
        onChangeText={setHauteur}
        keyboardType="number-pad"
        placeholder="ex. 110"
        error={fieldErrors.hauteur}
      />

      <TextField
        label="Âge (facultatif)"
        value={âge}
        onChangeText={setÂge}
        keyboardType="number-pad"
        placeholder="ex. 8"
        error={fieldErrors.âge}
      />

      <TextField
        label="Race (facultatif)"
        value={race}
        onChangeText={setRace}
        autoCapitalize="words"
        placeholder="ex. Selle Français"
      />

      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Button
        label={submitLabel}
        loadingLabel={submitLoadingLabel}
        loading={loading}
        onPress={handleSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
});
