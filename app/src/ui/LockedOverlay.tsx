import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, minTouchTarget, radius, spacing } from '../theme';
import { Text } from './Text';

export interface LockedOverlayProps {
  /** Titre de la fonction verrouillée (ex. « Analytique de diagnostic »). */
  titre: string;
  /** Aperçu **grisé** (le rendu réel désaturé) montré sous le voile. */
  children: ReactNode;
  /** Ouvre le flux d'upgrade (verrouillage = invitation, UI/UX §7). */
  onUpgrade: () => void;
  /** Libellé du CTA. Défaut : « Débloquer ». */
  cta?: string;
}

/**
 * **État verrouillé générique** (lot 4.2, UI/UX §3.1/§4/§6.8) — primitive
 * **réutilisable** : un **aperçu grisé** (désaturé) sous un **voile crème (~55 %)**
 * + un **cadenas** (encre douce) et une invitation. Toute la surface est tactile
 * (≥ 44 px) → ouvre l'upgrade (**verrouillage = invitation**, jamais culpabilisant,
 * §7).
 *
 * C'est le **slot** que les fonctions payantes (analytique 5.1, bilans 4.4/4.5,
 * invités 4.6) habilleront : elles passent leur aperçu en `children` et leur
 * `onUpgrade` — sans redéclarer le voile/cadenas/CTA. L'**autorité du gating
 * reste serveur** : ce composant ne décide rien, il **invite** (cf. `LockedFeature`
 * qui lit l'entitlement pour décider d'afficher ce voile ou le contenu réel).
 */
export function LockedOverlay({
  titre,
  children,
  onUpgrade,
  cta = 'Débloquer',
}: LockedOverlayProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${titre} — fonction verrouillée. ${cta}.`}
      accessibilityHint="Ouvre les forfaits pour débloquer cette fonction."
      onPress={onUpgrade}
      style={styles.container}
    >
      {/* Aperçu réel désaturé (non interactif) — laissé deviner sous le voile. */}
      <View style={styles.preview} pointerEvents="none">
        {children}
      </View>

      {/* Voile crème ~55 % + cadenas + invitation (UI/UX §3.1/§6.8). */}
      <View style={styles.veil} pointerEvents="none">
        <View style={styles.lockBadge}>
          <Ionicons name="lock-closed" size={26} color={colors.textMuted} />
        </View>
        <Text variant="h2" style={styles.centered}>
          {titre}
        </Text>
        <View style={styles.ctaPill}>
          <Text variant="label" color="onPrimary">
            {cta}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    minHeight: minTouchTarget,
  },
  preview: {
    flex: 1,
    // Surface désaturée : l'aperçu reste lisible mais clairement « éteint ».
    opacity: 0.45,
  },
  veil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.lockedVeil,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  lockBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  ctaPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginTop: spacing.xxs,
  },
});
