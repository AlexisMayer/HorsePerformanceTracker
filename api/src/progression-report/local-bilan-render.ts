import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Injectable } from '@nestjs/common';
import type { BilanArtefactRendu, BilanDocument, BilanRenderPort } from './bilan-render.port';

/**
 * **Adaptateur de rendu local/stub** (lot 4.4, Stack §5) — l'implémentation de
 * **dev** du `BilanRenderPort` : elle écrit le **document HTML autonome** dans un
 * répertoire local et renvoie une **URL `file://`** (le lien web du livrable),
 * **sans dépendance lourde**. Elle prouve la chaîne complète
 * *composition → HTML+CSS → sortie fichier* de la DoD.
 *
 * **Format `pdf` = stub en dev** : on ne peut pas produire un vrai PDF sans le
 * moteur Playwright (chaîne prod : Serverless Job → Object Storage → URL
 * présignée, **différée infra**, cf. journal). On matérialise alors le **même HTML**
 * en substitut et on le **signale** (`stub: true`) — honnête et non bloquant. Le
 * format `lien` est, lui, un livrable **réel** (`stub: false`) : le HTML **est** le
 * document.
 *
 * Le répertoire de sortie est configurable par `BILAN_OUTPUT_DIR` (défaut : un
 * sous-dossier du temporaire système), jamais un chemin en dur.
 */
@Injectable()
export class LocalBilanRender implements BilanRenderPort {
  private readonly outputDir = process.env.BILAN_OUTPUT_DIR ?? join(tmpdir(), 'hpt-bilans');

  async render(doc: BilanDocument): Promise<BilanArtefactRendu> {
    await mkdir(this.outputDir, { recursive: true });
    // Nom sûr : on assainit la base (le nom du cheval est saisi) + un suffixe unique.
    const base = slugify(doc.nomFichier) || 'bilan';
    const chemin = join(this.outputDir, `${base}-${randomUUID()}.html`);
    const octets = Buffer.byteLength(doc.html, 'utf8');
    await writeFile(chemin, doc.html, 'utf8');

    return {
      url: pathToFileURL(chemin).href,
      type_contenu: 'text/html; charset=utf-8',
      taille_octets: octets,
      // `lien` = document réel ; `pdf` = substitut de dev (vrai PDF = chaîne prod).
      stub: doc.format === 'pdf',
    };
  }
}

/** Réduit une base de nom de fichier à des caractères sûrs (accents aplatis). */
function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
