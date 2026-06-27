import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

export interface ScreenProps {
  children: ReactNode;
  /** Contenu défilant (formulaires longs). Défaut : `false`. */
  scroll?: boolean;
  /** Centre verticalement le contenu (écrans d'auth courts). */
  center?: boolean;
  contentStyle?: ViewStyle;
  edges?: readonly Edge[];
}

/**
 * Conteneur d'écran — fond Crème (mode clair, §3.1/§8), zone sûre, marges
 * latérales généreuses (atteinte au pouce, §3.3). Gère l'évitement du clavier
 * pour les écrans de saisie d'auth.
 */
export function Screen({
  children,
  scroll = false,
  center = false,
  contentStyle,
  edges = ['top', 'left', 'right'],
}: ScreenProps) {
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, center && styles.center, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.content, center && styles.center, contentStyle]}
    >
      {children}
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView edges={edges} style={styles.safe}>
      {inner}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  center: {
    justifyContent: 'center',
  },
});
