import { AnalytiqueAperçu, AnalytiqueContenu } from '../../analytics';
import { LockedFeature } from '../../entitlements';
import { HorseSelector, useHorses } from '../../horses';
import { Screen } from '../../ui';
import { ScreenHeader } from '../../ui/ScreenHeader';

/**
 * Onglet **Analytique** (UI/UX §5/§6.5) — le **diagnostic premium** du cheval
 * courant : la **heatmap type × hauteur** (5.1) **puis**, dessous, le **benchmark à
 * combinaison constante** (5.2). Scopé au **cheval de l'en-tête** (sélecteur
 * réutilisé, 1.4).
 *
 * **Gating = autorité serveur** (4.1) : **un seul** `LockedFeature` couvre **toute**
 * l'Analytique (heatmap + benchmark) — il lit l'entitlement pour décider quoi
 * afficher, il ne tranche rien (les endpoints refusent le gratuit en 403). En
 * **gratuit**, la fonction est **grisée + cadenas** (verrou générique 4.2 : aperçu
 * factice sous voile) et son appui ouvre l'upgrade **premium** (verrouillage =
 * invitation, §7). En **premium/pro**, on rend le **vrai** contenu
 * (`AnalytiqueContenu`).
 */
export default function AnalytiqueScreen() {
  const { currentHorse } = useHorses();
  const chevalId = currentHorse?.id ?? null;

  return (
    <Screen edges={['left', 'right']} contentStyle={{ flex: 1, padding: 0, gap: 0 }}>
      <ScreenHeader title="Analytique" right={<HorseSelector />} />
      <LockedFeature
        capacité="analytique_diagnostic"
        titre="Analytique de diagnostic"
        aperçu={<AnalytiqueAperçu />}
      >
        <AnalytiqueContenu chevalId={chevalId} />
      </LockedFeature>
    </Screen>
  );
}
