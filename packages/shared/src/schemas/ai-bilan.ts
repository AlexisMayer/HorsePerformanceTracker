import { z } from 'zod';

/**
 * Contrats `shared` du **bilan augmenté** (assistant IA — lot 4.5, Spec §7,
 * module `ai-bilan`). Source de vérité unique partagée app/api (Architecture
 * §1/§2) : aucun type dupliqué. Pour **une séance**, le module produit un
 * **texte consultatif** (analyse de la dernière séance + recommandations pour la
 * prochaine), **généré par IA** (Mistral, UE), **à la demande**, **persisté** et
 * **relu sans régénération** (Spec §7.1–§7.3, Stack §3.6).
 *
 * **Jamais une métrique** (Modèle §1) : la sortie est du **texte**, elle
 * n'alimente aucune courbe ni agrégat — c'est ce qui autorise à s'appuyer sur les
 * **deux couches** (objective + contexte qualitatif) comme matière narrative.
 *
 * **Premium/Pro** (§8) : l'endpoint est gardé par l'entitlement (4.1, capacité
 * `bilan_augmenté`) — **refusé au gratuit** ; l'invité (4.6) n'y a **pas** accès.
 */

/**
 * **Disclaimer IA** (Spec §7.2, principe « assister sans remplacer »). Toujours
 * attaché à la sortie et affiché avec le bilan : le texte est **clairement
 * généré par IA**, à valider par le cavalier/coach ; **ni** avis vétérinaire,
 * **ni** substitut au coach. Source unique (app + api la lisent d'ici).
 */
export const DISCLAIMER_IA =
  'Texte généré par une IA, à valider par le cavalier ou le coach. Ce n’est ni un avis vétérinaire, ni un substitut au coach.';

/** Le **contenu** consultatif du bilan augmenté (Modèle §3) — deux textes. */
export const contenuBilanAugmentéSchema = z.object({
  /** Bilan de la **dernière** séance analysée. */
  analyse: z.string(),
  /** Recommandations pour la **prochaine** séance. */
  recommandations: z.string(),
});

export type ContenuBilanAugmenté = z.infer<typeof contenuBilanAugmentéSchema>;

/**
 * DTO de **sortie** d'un bilan augmenté (généré ou relu). Projection de la ligne
 * persistée : identité + provenance IA (**modèle + version épinglés**) +
 * `date_génération` + `contenu` regroupé + `disclaimer` (toujours présent,
 * réattaché à la lecture depuis la constante — jamais persisté). Validé au bord
 * (Architecture §5) ; aucune donnée technique superflue.
 */
export const bilanAugmentéSortieSchema = z.object({
  id: z.string(),
  seance_id: z.string(),
  date_génération: z.date(),
  modèle: z.string(),
  version: z.string(),
  contenu: contenuBilanAugmentéSchema,
  disclaimer: z.string(),
});

export type BilanAugmentéSortie = z.infer<typeof bilanAugmentéSortieSchema>;

/**
 * DTO de **disponibilité** : pour un cheval, les `seance_ids` qui **possèdent**
 * déjà un bilan augmenté. C'est ce que la surface **Historique** (3.4) lit pour
 * remplir le **slot ✦** (badge « augmenté ») **uniquement** là où un bilan
 * existe — sans rapatrier le contenu ni déclencher d'appel IA.
 */
export const bilansAugmentésDisponiblesSchema = z.object({
  cheval_id: z.string(),
  seance_ids: z.array(z.string()),
});

export type BilansAugmentésDisponibles = z.infer<typeof bilansAugmentésDisponiblesSchema>;
