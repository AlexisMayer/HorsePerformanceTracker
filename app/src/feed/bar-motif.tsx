import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';

export interface BarMotifProps {
  /** Couleur de la barre (Vert sous-bois = maîtrisée, Laiton = record/jalon). */
  tone?: 'celebration' | 'primary';
}

/**
 * **Signature « hauteur-comme-barre »** (UI/UX §2) en version compacte : une barre
 * d'obstacle posée sur deux chandeliers. Réservée ici à la **carte de jalon**
 * (barre **laiton**, célébration — §3.1). Le bloc héros plein (grand chiffre +
 * courbe) est le lot **3.2** ; ce motif minimal ne préjuge pas de sa forme.
 */
export function BarMotif({ tone = 'celebration' }: BarMotifProps) {
  const barColor = tone === 'celebration' ? colors.celebration : colors.primary;
  return (
    <View style={styles.frame} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={[styles.post, styles.postLeft]} />
      <View style={[styles.post, styles.postRight]} />
      <View style={[styles.bar, { backgroundColor: barColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  post: {
    position: 'absolute',
    bottom: 4,
    width: 3,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
  },
  postLeft: { left: 8 },
  postRight: { right: 8 },
  bar: {
    position: 'absolute',
    top: 10,
    left: 6,
    right: 6,
    height: 7,
    borderRadius: radius.pill,
  },
});
