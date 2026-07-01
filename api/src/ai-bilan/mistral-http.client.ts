import { Logger } from '@nestjs/common';
import type { AiBilanConfig } from './ai-bilan.config';
import type {
  BilanAugmentéGénéré,
  ContexteBilanIA,
  MistralPort,
  SéanceContexteIA,
} from './mistral.port';

/**
 * Adaptateur **réel** du port Mistral (lot 4.5, Stack §3.6) — l'implémentation
 * concrète derrière `MistralPort`, parlant à l'**API Mistral (La Plateforme,
 * UE)**. Fin et isolé : toute l'orchestration (get-or-create, persistance,
 * rate limiting, garde) est dans `ai-bilan.service` (testée avec le **stub**).
 * Ce fichier n'est **jamais** importé par un test — couvert par `tsc` (même
 * posture que le client Mollie 4.2 ou les adaptateurs natifs de l'app 2.3/3.3).
 *
 * **Modèle épinglé** (`config.version`, ex. `mistral-small-2409`) — **jamais**
 * `-latest` (Stack §3.6). On demande une **sortie JSON** structurée
 * (`analyse` / `recommandations`) pour un découpage fiable ; à défaut, tout le
 * texte tombe dans `analyse`. **RGPD** : seules les données de séance (jamais de
 * PII) transitent (Stack §7.2).
 */
const SYSTEM_PROMPT =
  "Tu es un assistant d'entraînement en saut d'obstacles. À partir des données " +
  'de séances fournies, rédige un bilan consultatif court et bienveillant en ' +
  'français. Réponds UNIQUEMENT par un objet JSON avec deux clés : "analyse" ' +
  '(bilan de la dernière séance) et "recommandations" (conseils concrets pour ' +
  'la prochaine). Reste factuel ; tu ne donnes ni avis vétérinaire ni diagnostic.';

interface MistralChatResponse {
  choices?: { message?: { content?: string } }[];
}

export class MistralHttpClient implements MistralPort {
  private readonly logger = new Logger(MistralHttpClient.name);

  constructor(private readonly config: AiBilanConfig & { apiKey: string }) {}

  async générerBilan(contexte: ContexteBilanIA): Promise<BilanAugmentéGénéré> {
    const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        // Version **épinglée** appelée (jamais `-latest`).
        model: this.config.version,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: promptUtilisateur(contexte) },
        ],
      }),
    });

    if (!response.ok) {
      this.logger.error(`Mistral a répondu ${response.status}`);
      throw new Error(`Mistral request failed with status ${response.status}`);
    }

    const data = (await response.json()) as MistralChatResponse;
    const contenu = data.choices?.[0]?.message?.content ?? '';
    const { analyse, recommandations } = découperContenu(contenu);

    return { modèle: this.config.modèle, version: this.config.version, analyse, recommandations };
  }
}

/** Sérialise le contexte en message utilisateur lisible pour le modèle. */
function promptUtilisateur(contexte: ContexteBilanIA): string {
  const ligne = (s: SéanceContexteIA, label: string): string =>
    `${label} — ${s.date}, type ${s.type} (${s.provenance})` +
    (s.hauteur_max === null
      ? ', régularité (pas de hauteur)'
      : `, ${s.hauteur_max} cm, ${s.efforts_propres}/${s.efforts_totaux} propres` +
        (s.sans_faute ? ', sans-faute' : '')) +
    (s.ressenti_global !== null ? `, ressenti ${s.ressenti_global}/5` : '') +
    (s.énergie !== null ? `, énergie ${s.énergie}/5` : '') +
    (s.note ? `, note « ${s.note} »` : '');

  const lignes = [
    ligne(contexte.dernière, 'Dernière séance'),
    ...contexte.précédentes.map((s, i) => ligne(s, `Séance précédente ${i + 1}`)),
  ];
  return lignes.join('\n');
}

/** Découpe la réponse JSON du modèle ; repli robuste si le JSON est absent. */
function découperContenu(contenu: string): { analyse: string; recommandations: string } {
  try {
    const parsed = JSON.parse(contenu) as { analyse?: unknown; recommandations?: unknown };
    const analyse = typeof parsed.analyse === 'string' ? parsed.analyse : contenu;
    const recommandations =
      typeof parsed.recommandations === 'string' ? parsed.recommandations : '';
    return { analyse, recommandations };
  } catch {
    // Le modèle n'a pas renvoyé de JSON : on garde le texte brut comme analyse.
    return { analyse: contenu, recommandations: '' };
  }
}
