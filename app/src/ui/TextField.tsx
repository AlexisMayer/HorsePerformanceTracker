import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { colors, fontFamily, minTouchTarget, radius, spacing } from '../theme';
import { Text } from './Text';

export interface TextFieldProps extends TextInputProps {
  /** Libellé explicite (UI/UX §8 : libellés pour lecteurs d'écran). */
  label: string;
  /** Message d'erreur — affiché en Rouille (sémantique faute, §3.1). */
  error?: string;
}

/**
 * Champ de saisie de base (UI/UX §3/§8). Libellé visible, cible ≥ 44 px, bord
 * de focus en accent primaire, message d'erreur explicite « de son côté de
 * l'écran » (Architecture §5).
 */
export function TextField({ label, error, style, onFocus, onBlur, ...props }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.container}>
      <Text variant="label" color="textMuted">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { borderColor }, style]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxs,
  },
  input: {
    minHeight: minTouchTarget + 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fontFamily.body,
    fontSize: 16,
  },
});
