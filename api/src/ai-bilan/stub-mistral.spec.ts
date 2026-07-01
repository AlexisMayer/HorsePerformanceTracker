import { describe, expect, it } from 'vitest';
import type { AiBilanConfig } from './ai-bilan.config';
import type { ContexteBilanIA, SéanceContexteIA } from './mistral.port';
import { StubMistral } from './stub-mistral';

/**
 * Le **stub Mistral** (lot 4.5) — adaptateur de dev/test **déterministe** et
 * **sans réseau** (consigne : le sandbox n'atteint pas Mistral). On prouve :
 *  - **déterminisme** : même contexte ⇒ même sortie ;
 *  - **modèle + version épinglés** repris de la config (Stack §3.6) ;
 *  - **texte consultatif** (Modèle §1) qui s'appuie sur l'objectif et le contexte.
 */

const CONFIG: AiBilanConfig = {
  modèle: 'mistral-small',
  version: 'mistral-small-2409',
  apiKey: null,
  baseUrl: 'https://api.mistral.ai',
  rateLimitMax: 10,
  rateLimitFenêtreMs: 3_600_000,
};

function séance(partial: Partial<SéanceContexteIA> = {}): SéanceContexteIA {
  return {
    date: '2026-06-30T10:00:00.000Z',
    type: 'Gymnastique',
    provenance: 'live',
    hauteur_max: 110,
    efforts_propres: 4,
    efforts_totaux: 5,
    taux_réussite: 0.8,
    sans_faute: false,
    ressenti_global: null,
    énergie: null,
    note: null,
    ...partial,
  };
}

describe('StubMistral', () => {
  it('est déterministe (même contexte ⇒ même sortie)', async () => {
    const stub = new StubMistral(CONFIG);
    const contexte: ContexteBilanIA = { dernière: séance(), précédentes: [séance()] };
    const a = await stub.générerBilan(contexte);
    const b = await stub.générerBilan(contexte);
    expect(a).toEqual(b);
  });

  it('trace le modèle + version ÉPINGLÉS de la config (jamais `-latest`)', async () => {
    const stub = new StubMistral(CONFIG);
    const r = await stub.générerBilan({ dernière: séance(), précédentes: [] });
    expect(r.modèle).toBe('mistral-small');
    expect(r.version).toBe('mistral-small-2409');
    expect(r.version).not.toContain('latest');
  });

  it('produit un texte consultatif appuyé sur l’objectif + le contexte qualitatif', async () => {
    const stub = new StubMistral(CONFIG);
    const r = await stub.générerBilan({
      dernière: séance({ hauteur_max: 115, note: 'un peu tendu', ressenti_global: 4 }),
      précédentes: [séance(), séance()],
    });
    expect(r.analyse).toContain('115 cm');
    expect(r.analyse).toContain('un peu tendu'); // le contexte qualitatif nourrit le texte
    expect(r.recommandations.length).toBeGreaterThan(0);
  });

  it('gère un Plat (aucune hauteur) sans planter', async () => {
    const stub = new StubMistral(CONFIG);
    const r = await stub.générerBilan({
      dernière: séance({
        type: 'Plat',
        hauteur_max: null,
        efforts_propres: null,
        efforts_totaux: null,
        taux_réussite: null,
        sans_faute: null,
      }),
      précédentes: [],
    });
    expect(r.analyse).toContain('régularité');
    expect(r.recommandations.length).toBeGreaterThan(0);
  });

  it('recommande de monter quand le taux est élevé, de consolider sinon', async () => {
    const stub = new StubMistral(CONFIG);
    const haut = await stub.générerBilan({
      dernière: séance({ hauteur_max: 110, taux_réussite: 1 }),
      précédentes: [],
    });
    const bas = await stub.générerBilan({
      dernière: séance({ hauteur_max: 110, taux_réussite: 0.4 }),
      précédentes: [],
    });
    expect(haut.recommandations).toContain('115'); // 110 + 5
    expect(bas.recommandations).toContain('consolider');
  });
});
