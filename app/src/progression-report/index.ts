/**
 * Surface app `progression-report` (lot 4.4) — écran de **génération** du bilan de
 * progression : curation (période + indicateurs), déclenchement, récupération du
 * **PDF/lien**. **Verrouillé au gratuit** via le verrou 4.2 (`LockedFeature`,
 * capacité `bilan_progression`, autorité serveur 4.1).
 */
export { BilanApercu } from './bilan-apercu';
export { BilanGenerator } from './bilan-generator';
export {
  PÉRIODE_PRESET_LABELS,
  PÉRIODE_PRESETS,
  type PériodePreset,
  périodePourPreset,
} from './period-presets';
export { createProgressionReportApi, type ProgressionReportApi } from './progression-report-api';
export { useGénérerBilan } from './use-progression-report';
