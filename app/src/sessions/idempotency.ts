/**
 * Génération de la **clé d'idempotence** côté client (lot 2.3, Stack §4,
 * Architecture §5).
 *
 * L'API de création de séance (2.2) exige un `idempotency_key` au format UUID
 * (`z.string().uuid()`), **généré côté client** : un réessai après coupure
 * réutilise la **même** clé, donc le serveur renvoie la séance déjà créée sans
 * doublon (`UNIQUE(cheval_id, idempotency_key)`). La clé est attachée au
 * **brouillon** à sa création et reste stable tant que la séance n'est pas
 * enregistrée.
 *
 * On préfère `crypto.randomUUID()` quand il existe (Node, navigateurs, Hermes
 * récent) ; sinon on construit un UUID v4 RFC 4122 à partir de
 * `crypto.getRandomValues` (ou, en tout dernier recours, `Math.random`). Le
 * résultat passe toujours la validation `uuid` du serveur. Module **pur** :
 * testable en Node, sans dépendance native.
 */

interface MinimalCrypto {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
}

function getCrypto(): MinimalCrypto | undefined {
  return (globalThis as { crypto?: MinimalCrypto }).crypto;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const cryptoObj = getCrypto();
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

/** Construit un UUID v4 RFC 4122 à partir de 16 octets aléatoires. */
function uuidV4FromBytes(bytes: Uint8Array): string {
  // Version 4 (bits 12-15 du time_hi) et variante RFC 4122 (bits 6-7 du clock_seq).
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = HEX;
  return (
    `${h[bytes[0]]}${h[bytes[1]]}${h[bytes[2]]}${h[bytes[3]]}-` +
    `${h[bytes[4]]}${h[bytes[5]]}-` +
    `${h[bytes[6]]}${h[bytes[7]]}-` +
    `${h[bytes[8]]}${h[bytes[9]]}-` +
    `${h[bytes[10]]}${h[bytes[11]]}${h[bytes[12]]}${h[bytes[13]]}${h[bytes[14]]}${h[bytes[15]]}`
  );
}

/** Génère une nouvelle clé d'idempotence (UUID v4) pour un brouillon de séance. */
export function newIdempotencyKey(): string {
  const cryptoObj = getCrypto();
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return uuidV4FromBytes(randomBytes(16));
}
