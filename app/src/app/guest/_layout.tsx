import { Ionicons } from '@expo/vector-icons';
import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth';
import { ReadOnlyBanner, useGuestAccess } from '../../guest-access';
import { TabBarButton } from '../../navigation/tab-bar';
import { colors, spacing } from '../../theme';
import { Text } from '../../ui';

/**
 * **Coquille invité** (lot 4.6, UI/UX §5/§6.7) — la vue **lecture seule** d'un
 * client sur le cheval partagé. Mêmes onglets de **consultation** que le
 * propriétaire — **Feed · Historique · Analytique** — mais **sans le bouton ( + )**
 * (aucune saisie), **sans sélecteur multi-chevaux** (accès scopé à UN cheval) et
 * **sans ✦** (bilan augmenté exclu, câblé nulle part ici). Un **bandeau « lecture
 * seule »** est visible en permanence (UI/UX §4), sous le nom du cheval partagé.
 *
 * Les onglets **réutilisent** les surfaces livrées (feed 3.1, héros 3.2, historique
 * 3.4, analytique 5.1) via leur `basePath` invité (`read-scope`) — rien n'est
 * reconstruit. Le seul point de sortie est la **déconnexion** (l'invité est un
 * compte régulier).
 */
const GUEST_TABS = [
  { name: 'index', href: '/guest', label: 'Feed', icon: 'home-outline', iconActive: 'home' },
  {
    name: 'historique',
    href: '/guest/historique',
    label: 'Historique',
    icon: 'time-outline',
    iconActive: 'time',
  },
  {
    name: 'analytique',
    href: '/guest/analytique',
    label: 'Analytique',
    icon: 'stats-chart-outline',
    iconActive: 'stats-chart',
  },
] as const;

export default function GuestLayout() {
  const insets = useSafeAreaInsets();
  const { sharedHorses } = useGuestAccess();
  const { signOut } = useAuth();
  // Accès scopé à UN cheval (Spec §9.5) : la coquille montre le cheval partagé.
  const horseName = sharedHorses[0]?.cheval_nom ?? 'Cheval partagé';

  return (
    <Tabs>
      <View style={[styles.top, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text variant="h2" numberOfLines={1} style={styles.name}>
            {horseName}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Se déconnecter"
            hitSlop={8}
            onPress={() => signOut.mutate()}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
        <ReadOnlyBanner />
      </View>
      <TabSlot />
      <TabList style={[styles.bar, { paddingBottom: insets.bottom + spacing.xs }]}>
        {GUEST_TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
            <TabBarButton label={tab.label} icon={tab.icon} iconActive={tab.iconActive} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  top: {
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  name: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
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
