import type { CarteBilan } from '@hpt/shared';
import { describe, expect, it } from 'vitest';
import {
  formatCarteDate,
  fractionRéussie,
  hauteursRésumé,
  messagePartage,
  nomFichierCarte,
  travailRésumé,
} from './card-format';

/** Carte de base (entraînement avec record) — surchargée par cas. */
function carte(patch: Partial<CarteBilan> = {}): CarteBilan {
  return {
    seance_id: 's1',
    cheval_id: 'c1',
    date: new Date('2026-03-12T12:00:00Z'),
    type: 'Parcours',
    types_travaillés: ['Vertical', 'Oxer'],
    hauteurs: [100, 110],
    faits: {
      hauteur_max: 110,
      efforts_totaux: 5,
      efforts_propres: 4,
      taux_réussite: 0.8,
      sans_faute: false,
    },
    record: null,
    ...patch,
  };
}

describe('formatCarteDate', () => {
  it('rend une date lisible avec l’année (artefact autonome), tolérante au transport', () => {
    const fromDate = formatCarteDate(new Date('2026-03-12T12:00:00Z'));
    const fromIso = formatCarteDate('2026-03-12T12:00:00Z');
    expect(fromDate).toContain('12');
    expect(fromDate).toContain('2026');
    expect(fromIso).toBe(fromDate);
  });

  it('renvoie une chaîne vide pour une date illisible (jamais « Invalid Date »)', () => {
    expect(formatCarteDate('pas-une-date')).toBe('');
  });
});

describe('fractionRéussie', () => {
  it('libelle « propre » pour un entraînement', () => {
    expect(fractionRéussie(carte())).toBe('4/5 propre');
  });

  it('libelle « sans-faute » pour un concours (même calcul, libellé via le type)', () => {
    expect(
      fractionRéussie(
        carte({
          type: 'Concours',
          faits: {
            hauteur_max: 120,
            efforts_totaux: 2,
            efforts_propres: 2,
            taux_réussite: 1,
            sans_faute: true,
          },
        }),
      ),
    ).toBe('2/2 sans-faute');
  });

  it('renvoie null pour une régularité (faits null)', () => {
    expect(fractionRéussie(carte({ faits: null }))).toBeNull();
  });
});

describe('travailRésumé & hauteursRésumé', () => {
  it('joint les types travaillés, null si aucun', () => {
    expect(travailRésumé(carte())).toBe('Vertical, Oxer');
    expect(travailRésumé(carte({ types_travaillés: [] }))).toBeNull();
  });

  it('rend une plage de hauteurs, une seule, ou null', () => {
    expect(hauteursRésumé(carte())).toBe('100–110 cm');
    expect(hauteursRésumé(carte({ hauteurs: [110] }))).toBe('110 cm');
    expect(hauteursRésumé(carte({ hauteurs: [] }))).toBeNull();
  });
});

describe('messagePartage (repli texte, sans emoji — laiton réservé à l’UI)', () => {
  it('inclut le récap et le record quand il y en a un', () => {
    const msg = messagePartage(carte({ record: 110 }), 'Quibelle');
    expect(msg).toContain('Quibelle');
    expect(msg).toContain('Vertical, Oxer · 100–110 cm');
    expect(msg).toContain('Réussite : 4/5 propre');
    expect(msg).toContain('Nouveau record : 110 cm');
    expect(msg).toContain('Suivi avec Horse Performance Tracker');
    // Aucune fausse célébration en texte non plus.
    expect(msg).not.toMatch(/[🏆🎉]/u);
  });

  it('omet le record absent et résume une régularité (Plat) sobrement', () => {
    const msg = messagePartage(
      carte({ type: 'Plat', types_travaillés: [], hauteurs: [], faits: null, record: null }),
      'Sobre',
    );
    expect(msg).toContain('Régularité');
    expect(msg).not.toContain('Nouveau record');
    expect(msg).not.toContain('Réussite');
  });
});

describe('nomFichierCarte', () => {
  it('slugifie le nom (accents retirés) + date ISO + extension png', () => {
    expect(nomFichierCarte(carte(), 'Quibelle')).toBe('bilan-quibelle-2026-03-12.png');
    expect(nomFichierCarte(carte(), 'Évörà du Pré')).toBe('bilan-evora-du-pre-2026-03-12.png');
  });

  it('retombe sur « cheval » pour un nom vide/non alphanumérique', () => {
    expect(nomFichierCarte(carte(), '   ')).toBe('bilan-cheval-2026-03-12.png');
  });
});
