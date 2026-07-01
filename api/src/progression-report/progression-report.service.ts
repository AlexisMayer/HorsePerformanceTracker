import {
  type BilanProgression,
  type BilanProgressionParams,
  bilanProgressionSchema,
} from '@hpt/shared';
import { Inject, Injectable } from '@nestjs/common';
import { HorsesService } from '../horses/horses.service';
import { MetricsService } from '../metrics/metrics.service';
import { SessionsService } from '../sessions/sessions.service';
import { BILAN_RENDER, type BilanRenderPort } from './bilan-render.port';
import { composeBilanSections } from './compose-bilan';
import { renderBilanHtml } from './render-bilan-html';

/**
 * Service de domaine **`progression-report`** (lot 4.4, Architecture §3) — le
 * **vrai générateur** de bilan de progression (Spec §6), **explicitement découplé**
 * de l'aperçu démo de 3.5. Surface de **lecture/composition** : il **compose** un
 * artefact autonome (PDF/lien), il n'écrit **aucune** entité métier — la donnée
 * reste **inviolable** (§2). Il **orchestre** trois services exposés et **ne
 * recalcule rien** (Architecture §2, une seule implémentation) :
 *
 *  - `horses.findOne` — l'**identité** (fiche cheval), 404 sans fuite si étranger ;
 *  - `sessions.listForHorse` — l'**historique** (`live` + `déclaratif`) via le
 *    service (jamais ses tables, §1/§3) — la composition filtre le `live` (§2) ;
 *  - `metrics.compose` — la **hauteur maîtrisée** (§10) et sa **courbe** déjà
 *    dérivées (3.2), **réutilisées** telles quelles (aucune divergence de calcul).
 *
 * La **composition des sections** (curation §6.3 comprise) et le **rendu HTML**
 * sont des fonctions **pures** (testées sans DB) ; la **sortie** (fichier local en
 * dev, Object Storage/URL présignée en prod) passe par le **port** `BILAN_RENDER`.
 *
 * **Gating (§8)** : l'endpoint est protégé par la garde d'entitlement (4.1,
 * capacité `bilan_progression`) — **refusé au gratuit**. Premium = rapport
 * personnel (son cheval) ; pro = multi-chevaux (un rapport par cheval).
 */
@Injectable()
export class ProgressionReportService {
  constructor(
    private readonly horses: HorsesService,
    private readonly sessions: SessionsService,
    private readonly metrics: MetricsService,
    @Inject(BILAN_RENDER) private readonly render: BilanRenderPort,
  ) {}

  /**
   * Génère le bilan d'un cheval **du compte courant** (404 si étranger). La
   * **curation** (`params` : période + indicateurs) ne fait que **projeter** la
   * donnée dans le rapport ; rien n'est écrit ni modifié (§2/§6.3). Renvoie les
   * **sections** composées (pour un aperçu app) **et** l'**artefact** généré
   * (le livrable pour un client sans l'app).
   */
  async generate(
    compteId: string,
    chevalId: string,
    params: BilanProgressionParams,
  ): Promise<BilanProgression> {
    // Identité + garde de propriété (404 sans fuite). Puis historique brut et
    // métriques héros réutilisées — aucune métrique n'est recalculée ici.
    const cheval = await this.horses.findOne(compteId, chevalId);
    const [séances, métriques] = await Promise.all([
      this.sessions.listForHorse(compteId, chevalId),
      this.metrics.compose(compteId, chevalId),
    ]);

    // Composition pure des 6 sections (§6.2) + curation (§6.3).
    const sections = composeBilanSections({ cheval, séances, métriques, params });

    // Rendu HTML autonome (le lien / la source PDF) puis matérialisation via le
    // port (fichier local en dev ; Job → Object Storage → URL présignée en prod).
    const généré_le = new Date();
    const html = renderBilanHtml(sections, { généréLe: généré_le });
    const rendu = await this.render.render({
      html,
      nomFichier: `bilan-${cheval.nom}`,
      format: params.format,
    });

    // Validation/strip au bord (Architecture §5) : la forme sortante est garantie.
    return bilanProgressionSchema.parse({
      cheval_id: chevalId,
      généré_le,
      format: params.format,
      sections,
      artefact: { format: params.format, ...rendu },
    } satisfies BilanProgression);
  }
}
