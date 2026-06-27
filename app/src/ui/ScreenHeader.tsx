import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme';
import { Text } from './Text';

export interface ScreenHeaderProps {
  title: string;
  /**
   * Élément optionnel aligné à droite du titre (slot générique). Les onglets de
   * la coquille y placent le sélecteur de cheval (`HorseSelector`, lot 2.1) ;
   * `ui/` reste agnostique de la fonctionnalité.
   */
  right?: ReactNode;
}

/**
 * En-tête d'onglet (UI/UX §5) : titre + emplacement droit optionnel. En 1.4 cet
 * emplacement portait un sélecteur de cheval *inerte* (« Aucun cheval », aucun
 * cheval avant 2.1) ; depuis 2.1 il accueille le vrai `HorseSelector`.
 */
export function ScreenHeader({ title, right }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <Text variant="h1">{title}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
});
