import { Screen } from '../../ui';
import { EmptyState } from '../../ui/EmptyState';
import { ScreenHeader } from '../../ui/ScreenHeader';

/**
 * Onglet **Feed** (UI/UX §5/§6.2) — placeholder en état vide-invitation. Le fil
 * mono-cheval réel (héros « hauteur maîtrisée » + entrées de séance) arrive au
 * lot 3.1 ; ici on pose la coquille et l'invitation.
 */
export default function FeedScreen() {
  return (
    <Screen edges={['left', 'right']} contentStyle={{ flex: 1, padding: 0, gap: 0 }}>
      <ScreenHeader title="Feed" horseSelectorPlaceholder />
      <EmptyState
        icon="trophy-outline"
        title="Ton fil prendra vie ici"
        message="Dès ta première séance, ta hauteur maîtrisée et ta progression s'afficheront ici."
      />
    </Screen>
  );
}
