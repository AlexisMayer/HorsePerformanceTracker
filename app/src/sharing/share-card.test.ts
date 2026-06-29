import type { CarteBilan } from '@hpt/shared';
import { describe, expect, it, vi } from 'vitest';
import type { CartePartagePort, PartagePayload, PartageRésultat } from './card-share-port';
import { partagerCarte } from './share-card';

const CARTE: CarteBilan = {
  seance_id: 's1',
  cheval_id: 'c1',
  date: new Date('2026-03-12T12:00:00Z'),
  type: 'Parcours',
  types_travaillés: ['Oxer'],
  hauteurs: [110],
  faits: {
    hauteur_max: 110,
    efforts_totaux: 4,
    efforts_propres: 4,
    taux_réussite: 1,
    sans_faute: true,
  },
  record: 110,
};

/** Port factice : capture programmable + partage qui enregistre sa charge utile. */
function fakePort(capturer: () => Promise<string | null>) {
  const partager = vi.fn(
    async (_payload: PartagePayload): Promise<PartageRésultat> => ({
      statut: 'partagé',
      média: 'image',
    }),
  );
  const port: CartePartagePort = { capturer: vi.fn(capturer), partager };
  return { port, partager };
}

describe('partagerCarte — orchestration (export image + repli texte)', () => {
  it('capture réussie ⇒ partage de l’image (URI transmise à la feuille native)', async () => {
    const { port, partager } = fakePort(async () => 'file:///tmp/bilan.png');
    const res = await partagerCarte(port, { current: null }, CARTE, 'Quibelle');

    expect(res).toEqual({ statut: 'partagé', média: 'image' });
    expect(partager).toHaveBeenCalledTimes(1);
    const payload = partager.mock.calls[0][0];
    expect(payload.uri).toBe('file:///tmp/bilan.png');
    // Le message de repli est toujours fourni (récap), et le titre nomme le cheval.
    expect(payload.message).toContain('Quibelle');
    expect(payload.message).toContain('Nouveau record : 110 cm');
    expect(payload.titre).toBe('Bilan de Quibelle');
  });

  it('capture indisponible (null) ⇒ partage texte (uri null), jamais bloqué', async () => {
    const { port, partager } = fakePort(async () => null);
    await partagerCarte(port, { current: null }, CARTE, 'Quibelle');
    expect(partager.mock.calls[0][0].uri).toBeNull();
  });

  it('capture qui échoue (exception) ⇒ repli texte sans crasher', async () => {
    const { port, partager } = fakePort(async () => {
      throw new Error('vue non montée');
    });
    await expect(partagerCarte(port, { current: null }, CARTE, 'Quibelle')).resolves.toBeDefined();
    expect(partager).toHaveBeenCalledTimes(1);
    expect(partager.mock.calls[0][0].uri).toBeNull();
  });

  it('propage le résultat du port (annulation utilisateur n’est pas une erreur)', async () => {
    const port: CartePartagePort = {
      capturer: vi.fn(async () => 'file:///tmp/bilan.png'),
      partager: vi.fn(async () => ({ statut: 'annulé' }) as PartageRésultat),
    };
    const res = await partagerCarte(port, { current: null }, CARTE, 'Quibelle');
    expect(res).toEqual({ statut: 'annulé' });
  });
});
