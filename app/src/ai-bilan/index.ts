/**
 * Module `ai-bilan` de l'app (lot 4.5) — la tranche front du **bilan augmenté**
 * par l'assistant IA (Spec §7). Surface React : la **section de génération** à
 * l'enregistrement (premium/pro, verrou 4.2 au gratuit), la **carte ✦** (avec
 * disclaimer) et les **hooks** de génération/relecture/disponibilité. La logique
 * testable sans React (`ai-bilan-api`) vit dans son module et est couverte par
 * Vitest.
 *
 * **À la demande, relu sans régénération** (§7.1/§7.3), **texte consultatif**
 * (jamais une métrique, Modèle §1). Le gating reste l'**autorité serveur** (4.1) :
 * l'app ne fait que griser et déclencher l'upgrade.
 */
export { type AiBilanApi, createAiBilanApi } from './ai-bilan-api';
export { AiBilanCard } from './ai-bilan-card';
export { AugmentedBilanSection } from './ai-bilan-section';
export {
  useBilanAugmenté,
  useBilansAugmentésDisponibles,
  useGénérerBilanAugmenté,
} from './use-ai-bilan';
