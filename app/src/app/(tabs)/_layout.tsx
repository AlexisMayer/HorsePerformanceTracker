import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui';
import { Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaptureFab, TabBarButton } from '../../navigation/tab-bar';
import { CAPTURE_FAB_POSITION, TABS } from '../../navigation/tabs';
import { colors, spacing } from '../../theme';

/**
 * Coquille de navigation (UI/UX §5) — tab bar **Feed · Historique · Analytique ·
 * Profil** + **bouton de saisie central (FAB)** intercalé au milieu. Construite
 * avec la navigation par onglets *headless* d'Expo Router (`expo-router/ui`)
 * pour maîtriser entièrement le rendu de la barre et le FAB surélevé. Les
 * onglets sont définis par `TABS` (source unique, aussi vérifiée par test).
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const left = TABS.slice(0, CAPTURE_FAB_POSITION);
  const right = TABS.slice(CAPTURE_FAB_POSITION);

  // FAB placeholder : la saisie réelle est 2.2/2.3 (hors périmètre 1.4).
  const handleCapture = () => {
    Alert.alert('Saisie', "La saisie d'une séance arrive au prochain lot.", [{ text: 'Compris' }]);
  };

  return (
    <Tabs>
      <TabSlot />
      <TabList style={[styles.bar, { paddingBottom: insets.bottom + spacing.xs }]}>
        {left.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
            <TabBarButton label={tab.label} icon={tab.icon} iconActive={tab.iconActive} />
          </TabTrigger>
        ))}
        <CaptureFab key="capture-fab" onPress={handleCapture} />
        {right.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
            <TabBarButton label={tab.label} icon={tab.icon} iconActive={tab.iconActive} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
