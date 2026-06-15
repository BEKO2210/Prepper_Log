// End-to-end encrypted backups: AES-256-GCM with a PBKDF2-derived key from the
// user's passphrase. No key or data ever leaves the device — the encrypted file
// is meant to be stored in the user's own cloud and imported on other devices.

const FORMAT = 'preptrack-encrypted-backup';
const VERSION = 1;
const DEFAULT_ITERATIONS = 210_000;

interface BackupEnvelope {
  format: string;
  v: number;
  kdf: 'PBKDF2';
  hash: 'SHA-256';
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Copy into a plain ArrayBuffer so the WebCrypto BufferSource types line up
// (TS 5.7's typed arrays are generic over ArrayBufferLike).
function ab(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function deriveKey(passphrase: string, salt: ArrayBuffer, iterations: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    ab(new TextEncoder().encode(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypts a plaintext string into a self-describing JSON envelope. */
export async function encryptBackup(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, ab(salt), DEFAULT_ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ab(iv) },
    key,
    ab(new TextEncoder().encode(plaintext))
  );
  const envelope: BackupEnvelope = {
    format: FORMAT,
    v: VERSION,
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iterations: DEFAULT_ITERATIONS,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(ciphertext)),
  };
  return JSON.stringify(envelope, null, 2);
}

/** True if the given text is a PrepTrack encrypted-backup envelope. */
export function isEncryptedBackup(text: string): boolean {
  try {
    const o = JSON.parse(text) as Partial<BackupEnvelope>;
    return o?.format === FORMAT && typeof o.ciphertext === 'string' && typeof o.salt === 'string';
  } catch {
    return false;
  }
}

/** Decrypts an envelope; throws if the passphrase is wrong or the file is corrupt. */
export async function decryptBackup(envelopeJson: string, passphrase: string): Promise<string> {
  let o: BackupEnvelope;
  try {
    o = JSON.parse(envelopeJson) as BackupEnvelope;
  } catch {
    throw new Error('invalid-backup');
  }
  if (o?.format !== FORMAT || !o.ciphertext || !o.salt || !o.iv) {
    throw new Error('invalid-backup');
  }
  const key = await deriveKey(passphrase, ab(b64ToBytes(o.salt)), o.iterations || DEFAULT_ITERATIONS);
  // AES-GCM throws (auth tag mismatch) on a wrong passphrase or tampered data.
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ab(b64ToBytes(o.iv)) },
    key,
    ab(b64ToBytes(o.ciphertext))
  );
  return new TextDecoder().decode(plaintext);
}
