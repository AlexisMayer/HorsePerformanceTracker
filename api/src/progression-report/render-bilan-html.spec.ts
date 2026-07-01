import type { BilanSections } from '@hpt/shared';
import { describe, expect, it } from 'vitest';
import { renderBilanHtml } from './render-bilan-html';

/**
 * Preuve **unitaire pure** (sans DB) du rendu HTML du bilan (lot 4.4, Stack §5) :
 * document **autonome** (le lien web / la source PDF), **couche objective
 * uniquement**, et **sûr** vis-à-vis des chaînes saisies (échappement).
 */

const meta = { généréLe: new Date('2026-03-31T10:00:00Z') };

const sectionsComplètes: BilanSections = {
  identité: { nom: 'Quibelle', niveau: 'amateur', hauteur_de_référence: 110, âge: 8, race: 'SF' },
  période: { from: new Date('2026-01-01'), to: new Date('2026-03-31'), nb_séances: 12 },
  niveau_démontré: { hauteur_maîtrisée: 115, record_sans_faute_concours: 120 },
  performance_concours: {
    total_tours: 3,
    tours_sans_faute: 2,
    taux_sans_faute: 2 / 3,
    par_hauteur: [{ hauteur: 120, tours: 1, sans_faute: 0, taux_sans_faute: 0 }],
  },
  régularité: {
    total_séances: 12,
    début: new Date('2026-01-03'),
    fin: new Date('2026-03-28'),
    jours_couverts: 85,
    séances_par_mois: 4.2,
    semaines_actives: 10,
    plus_longue_série_semaines: 6,
  },
  trajectoire: {
    points: [
      { date: new Date('2026-01-03'), hauteur: 100 },
      { date: new Date('2026-03-28'), hauteur: 115 },
    ],
    tendance: 'hausse',
    départ: 100,
    arrivée: 115,
  },
};

describe('renderBilanHtml — document autonome et soigné (§6, UI/UX §1)', () => {
  const html = renderBilanHtml(sectionsComplètes, meta);

  it('est un document HTML complet et auto-porté (styles inline, aucune ressource externe)', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<style>');
    // Aucune dépendance externe : pas de <link>/<script>/<img src=…>.
    expect(html).not.toMatch(/<link|<script|<img/);
  });

  it('rend les 6 sections quand elles sont présentes', () => {
    expect(html).toContain('Bilan de progression');
    expect(html).toContain('Quibelle');
    expect(html).toContain('Niveau démontré');
    expect(html).toContain('Performance en concours');
    expect(html).toContain('Régularité');
    expect(html).toContain('Trajectoire');
    expect(html).toContain('115 cm');
  });

  it('n’expose AUCUNE donnée de la couche contexte (jamais de ressenti/note/difficulté)', () => {
    const bas = html.toLowerCase();
    expect(bas).not.toContain('ressenti');
    expect(bas).not.toContain('difficulté');
    expect(bas).not.toContain('énergie');
  });

  it('omet les sections décochées (curation §6.3)', () => {
    const minimal = renderBilanHtml(
      { identité: sectionsComplètes.identité, période: sectionsComplètes.période },
      meta,
    );
    expect(minimal).toContain('Quibelle');
    expect(minimal).not.toContain('Performance en concours');
    expect(minimal).not.toContain('Régularité');
  });

  it('échappe les chaînes saisies (pas d’injection HTML dans le livrable)', () => {
    const html = renderBilanHtml(
      {
        identité: {
          nom: '<script>alert(1)</script>',
          niveau: 'amateur',
          hauteur_de_référence: 110,
          âge: null,
          race: null,
        },
        période: { from: null, to: null, nb_séances: 0 },
      },
      meta,
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
