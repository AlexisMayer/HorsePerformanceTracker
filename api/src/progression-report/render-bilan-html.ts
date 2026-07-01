import type {
  BilanSections,
  PerformanceConcoursBilan,
  RégularitéBilanDto,
  TrajectoireBilan,
} from '@hpt/shared';

/**
 * **Rendu HTML du bilan de progression** — fonction **pure** (lot 4.4, Stack §5,
 * UI/UX §1). Produit un **document autonome** (HTML + CSS **inline**, aucune
 * ressource externe) : c'est à la fois le **lien web** livrable et la **source du
 * PDF** (`HTML+CSS → PDF via Playwright` en prod). Pensé pour un lecteur **sans
 * l'app** (le client d'un coach) : sobre, lisible, sérieux — la **chaleur
 * équestre** (crème/sable/vert sous-bois, laiton réservé à la célébration) qui
 * donne du crédit au livrable pro (UI/UX §1/§2).
 *
 * **Couche objective uniquement** (Spec §6, Modèle §2) : ce document ne rend que
 * les sections composées (identité + dérivés `live`) — **jamais** de ressenti, de
 * note ou de difficulté. Les chaînes venant de l'utilisateur (nom, race) sont
 * **échappées** (aucune injection HTML possible dans le livrable).
 */

const MOIS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** Échappe le texte pour une insertion HTML sûre (le nom du cheval est saisi). */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Date en clair (jour mois année), stable (UTC) — pas de dépendance de locale. */
function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return `${d.getUTCDate()} ${MOIS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Taux [0, 1] en pourcentage entier, ou tiret cadratin si non calculable. */
function fmtPct(taux: number | null): string {
  return taux === null ? '—' : `${Math.round(taux * 100)} %`;
}

/** Nombre arrondi à une décimale (fréquence), tiret si null. */
function fmtDéc(n: number | null): string {
  return n === null ? '—' : (Math.round(n * 10) / 10).toString().replace('.', ',');
}

/** Hauteur en cm, ou tiret cadratin (rien de maîtrisé / pas de donnée). */
function fmtCm(h: number | null): string {
  return h === null ? '—' : `${h} cm`;
}

const TENDANCE_LABEL: Record<NonNullable<TrajectoireBilan['tendance']>, string> = {
  hausse: '↗ en progression',
  stable: '→ stable',
  baisse: '↘ en repli',
};

function renderPériode(from: Date | null, to: Date | null): string {
  if (from && to) return `${fmtDate(from)} – ${fmtDate(to)}`;
  if (from) return `depuis le ${fmtDate(from)}`;
  if (to) return `jusqu'au ${fmtDate(to)}`;
  return 'tout l’historique';
}

function renderNiveau(hauteur_maîtrisée: number | null, record: number | null): string {
  return `
    <section class="card">
      <h2>Niveau démontré</h2>
      <div class="stats">
        <div class="stat">
          <span class="stat-num">${fmtCm(hauteur_maîtrisée)}</span>
          <span class="stat-label">Hauteur maîtrisée</span>
        </div>
        <div class="stat">
          <span class="stat-num brass">${fmtCm(record)}</span>
          <span class="stat-label">Plus haut sans-faute en concours</span>
        </div>
      </div>
    </section>`;
}

function renderConcours(perf: PerformanceConcoursBilan): string {
  if (perf.total_tours === 0) {
    return `
    <section class="card">
      <h2>Performance en concours</h2>
      <p class="muted">Aucun tour de concours sur la période.</p>
    </section>`;
  }
  const lignes = perf.par_hauteur
    .map(
      (p) => `
        <tr>
          <td>${p.hauteur} cm</td>
          <td>${p.sans_faute} / ${p.tours}</td>
          <td>${fmtPct(p.taux_sans_faute)}</td>
        </tr>`,
    )
    .join('');
  return `
    <section class="card">
      <h2>Performance en concours</h2>
      <p><strong>${perf.tours_sans_faute}</strong> tours sans-faute sur <strong>${perf.total_tours}</strong>
        (${fmtPct(perf.taux_sans_faute)}).</p>
      <table>
        <thead><tr><th>Hauteur</th><th>Sans-faute</th><th>Taux</th></tr></thead>
        <tbody>${lignes}</tbody>
      </table>
    </section>`;
}

function renderRégularité(r: RégularitéBilanDto): string {
  return `
    <section class="card">
      <h2>Régularité &amp; suivi</h2>
      <div class="stats">
        <div class="stat"><span class="stat-num">${r.total_séances}</span><span class="stat-label">Séances</span></div>
        <div class="stat"><span class="stat-num">${fmtDéc(r.séances_par_mois)}</span><span class="stat-label">Séances / mois</span></div>
        <div class="stat"><span class="stat-num">${r.semaines_actives}</span><span class="stat-label">Semaines actives</span></div>
        <div class="stat"><span class="stat-num">${r.plus_longue_série_semaines}</span><span class="stat-label">Série la plus longue (sem.)</span></div>
      </div>
      <p class="muted">Du ${fmtDate(r.début)} au ${fmtDate(r.fin)} — la preuve du travail fourni.</p>
    </section>`;
}

function renderTrajectoire(t: TrajectoireBilan): string {
  const maîtrisés = t.points.map((p) => p.hauteur).filter((h): h is number => h !== null);
  const max = maîtrisés.length > 0 ? Math.max(...maîtrisés) : 0;
  const min = maîtrisés.length > 0 ? Math.min(...maîtrisés) : 0;
  const barres = t.points
    .map((p) => {
      // Signature « hauteur-comme-barre » : hauteur relative dans [10 %, 100 %].
      const rel =
        p.hauteur === null || max === min
          ? p.hauteur === null
            ? 0
            : 65
          : 10 + 90 * ((p.hauteur - min) / (max - min));
      return `<span class="bar" style="height:${rel.toFixed(0)}%" title="${fmtCm(p.hauteur)}"></span>`;
    })
    .join('');
  const tendance = t.tendance ? TENDANCE_LABEL[t.tendance] : '—';
  return `
    <section class="card">
      <h2>Trajectoire</h2>
      <p>De <strong>${fmtCm(t.départ)}</strong> à <strong>${fmtCm(t.arrivée)}</strong> maîtrisés — <strong>${tendance}</strong>.</p>
      <div class="chart" role="img" aria-label="Courbe de hauteur maîtrisée, ${tendance}.">${barres}</div>
    </section>`;
}

/** Assemble le document HTML autonome du bilan (les sections absentes sont omises). */
export function renderBilanHtml(sections: BilanSections, meta: { généréLe: Date }): string {
  const { identité, période } = sections;
  const détails = [
    `Niveau ${esc(identité.niveau)}`,
    `hauteur de référence ${identité.hauteur_de_référence} cm`,
    identité.âge != null ? `${identité.âge} ans` : null,
    identité.race ? esc(identité.race) : null,
  ]
    .filter((x): x is string => x !== null)
    .join(' · ');

  const corps = [
    sections.niveau_démontré
      ? renderNiveau(
          sections.niveau_démontré.hauteur_maîtrisée,
          sections.niveau_démontré.record_sans_faute_concours,
        )
      : '',
    sections.performance_concours ? renderConcours(sections.performance_concours) : '',
    sections.régularité ? renderRégularité(sections.régularité) : '',
    sections.trajectoire ? renderTrajectoire(sections.trajectoire) : '',
  ].join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Bilan de progression — ${esc(identité.nom)}</title>
<style>
  :root { --creme:#FBF7F0; --sable:#F1E9DA; --bordure:#E3D7C2; --vert:#2E5D44; --vertpale:#DCE8DF; --laiton:#C8861E; --encre:#20251F; --encredouce:#5C5A4E; }
  * { box-sizing: border-box; }
  body { margin:0; padding:32px; background:var(--creme); color:var(--encre); font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; font-size:15px; line-height:1.5; }
  .sheet { max-width:720px; margin:0 auto; }
  header { border-bottom:3px solid var(--vert); padding-bottom:16px; margin-bottom:24px; }
  header .kicker { color:var(--vert); font-weight:700; text-transform:uppercase; letter-spacing:.08em; font-size:12px; }
  header h1 { margin:4px 0 2px; font-size:30px; }
  header .meta { color:var(--encredouce); font-size:13px; }
  .card { background:var(--sable); border:1px solid var(--bordure); border-radius:14px; padding:20px; margin-bottom:16px; }
  .card h2 { margin:0 0 12px; font-size:18px; color:var(--vert); }
  .stats { display:flex; flex-wrap:wrap; gap:20px; }
  .stat { display:flex; flex-direction:column; min-width:120px; }
  .stat-num { font-size:28px; font-weight:800; font-variant-numeric:tabular-nums; }
  .stat-num.brass { color:var(--laiton); }
  .stat-label { color:var(--encredouce); font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
  table { width:100%; border-collapse:collapse; margin-top:8px; font-variant-numeric:tabular-nums; }
  th, td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--bordure); }
  th { color:var(--encredouce); font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
  .muted { color:var(--encredouce); font-size:13px; }
  .chart { display:flex; align-items:flex-end; gap:6px; height:120px; margin-top:12px; padding:8px; background:var(--vertpale); border-radius:10px; }
  .bar { flex:1; min-width:6px; background:var(--vert); border-radius:4px 4px 0 0; }
  footer { color:var(--encredouce); font-size:12px; border-top:1px solid var(--bordure); padding-top:12px; margin-top:8px; display:flex; justify-content:space-between; }
</style>
</head>
<body>
  <div class="sheet">
    <header>
      <div class="kicker">Bilan de progression</div>
      <h1>${esc(identité.nom)}</h1>
      <div class="meta">${détails}</div>
      <div class="meta">Période : ${renderPériode(période.from, période.to)} · ${période.nb_séances} séance${période.nb_séances > 1 ? 's' : ''}</div>
    </header>
    ${corps}
    <footer>
      <span>Horse Performance Tracker</span>
      <span>Généré le ${fmtDate(meta.généréLe)} · couche objective, séances vérifiées</span>
    </footer>
  </div>
</body>
</html>`;
}
