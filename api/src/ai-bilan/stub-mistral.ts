import { Injectable } from '@nestjs/common';
import type { AiBilanConfig } from './ai-bilan.config';
import type {
  BilanAugmentéGénéré,
  ContexteBilanIA,
  MistralPort,
  SéanceContexteIA,
} from './mistral.port';

/**
 * Adaptateur **stub** du port Mistral (lot 4.5) — **déterministe**, in-memory,
 * utilisé **par défaut** en dev **sans clé** (`MISTRAL_API_KEY` absente) et par
 * les tests. **Consigne** : le sandbox de dev n'atteint pas Mistral → aucun
 * appel réseau ici ; le texte est composé **localement** à partir du contexte,
 * de façon **reproductible** (même contexte ⇒ même sortie).
 *
 * Il **échoue jamais** et **trace le modèle/version épinglés** de la config
 * (Stack §3.6), exactement comme le ferait le vrai client — le service persiste
 * ces valeurs sans savoir quel adaptateur a répondu. C'est du **texte
 * consultatif** (Spec §7.2), jamais une métrique (Modèle §1).
 */
@Injectable()
export class StubMistral implements MistralPort {
  constructor(private readonly config: AiBilanConfig) {}

  async générerBilan(contexte: ContexteBilanIA): Promise<BilanAugmentéGénéré> {
    return {
      modèle: this.config.modèle,
      version: this.config.version,
      analyse: analyse(contexte.dernière, contexte.précédentes.length),
      recommandations: recommandations(contexte.dernière),
    };
  }
}

/** Rend un taux (0..1) en pourcentage entier lisible, ou `—` si indisponible. */
function pct(taux: number | null): string {
  return taux === null ? '—' : `${Math.round(taux * 100)} %`;
}

/** Analyse de la dernière séance (texte déterministe, à valider — Spec §7.2). */
function analyse(s: SéanceContexteIA, nbPrécédentes: number): string {
  const socle =
    s.hauteur_max === null
      ? `Séance de type ${s.type} axée sur la régularité (pas de franchissement chiffré).`
      : `Séance de type ${s.type} à ${s.hauteur_max} cm : ${s.efforts_propres}/${s.efforts_totaux} propres (${pct(s.taux_réussite)})${s.sans_faute ? ', sans-faute' : ''}.`;
  const ressenti =
    s.ressenti_global !== null || s.énergie !== null
      ? ` Ressenti global ${s.ressenti_global ?? '—'}/5, énergie ${s.énergie ?? '—'}/5.`
      : '';
  const note = s.note ? ` Note du cavalier : « ${s.note} ».` : '';
  const historique =
    nbPrécédentes > 0
      ? ` Analyse appuyée sur les ${nbPrécédentes} dernière(s) séance(s).`
      : ' Première séance de référence.';
  return `${socle}${ressenti}${note}${historique}`;
}

/** Recommandations pour la prochaine séance (texte déterministe, consultatif). */
function recommandations(s: SéanceContexteIA): string {
  if (s.hauteur_max === null) {
    return 'Pour la prochaine séance : introduire quelques franchissements simples pour mesurer la maîtrise, en gardant le rythme de travail.';
  }
  if (s.taux_réussite !== null && s.taux_réussite >= 0.8) {
    return `Pour la prochaine séance : la barre semble acquise à ${s.hauteur_max} cm — tenter ${s.hauteur_max + 5} cm sur quelques tentatives, en restant progressif.`;
  }
  return `Pour la prochaine séance : consolider ${s.hauteur_max} cm avant de monter, en réduisant barres et refus par des répétitions courtes.`;
}
