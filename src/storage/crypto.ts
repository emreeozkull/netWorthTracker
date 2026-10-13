import { gcm } from '@noble/ciphers/aes.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';

import { randomBytes } from './random';

/**
 * Encrypted envelope written to disk and to backup files.
 * AES-256-GCM; when `kdf` is present the key is derived from a password with scrypt.
 */
export interface Envelope {
  format: 'networth-enc';
  v: 1;
  kdf?: { name: 'scrypt'; N: number; r: number; p: number; salt: string };
  nonce: string;
  ct: string;
}

export const SCRYPT_PARAMS = { N: 2 ** 15, r: 8, p: 1 };

export class DecryptionError extends Error {
  constructor() {
    super('Decryption failed: wrong password or corrupted data');
    this.name = 'DecryptionError';
  }
}

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) throw new Error('Invalid hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// Hermes doesn't guarantee TextDecoder, so UTF-8 is handled by hand.
export function utf8Encode(str: string): Uint8Array {
  const out: number[] = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 63),
        0x80 | ((cp >> 6) & 63),
        0x80 | (cp & 63),
      );
  }
  return Uint8Array.from(out);
}

export function utf8Decode(bytes: Uint8Array): string {
  const chunks: string[] = [];
  let codes: number[] = [];
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let cp: number;
    if (b < 0x80) {
      cp = b;
      i += 1;
    } else if (b < 0xe0) {
      cp = ((b & 31) << 6) | (bytes[i + 1] & 63);
      i += 2;
    } else if (b < 0xf0) {
      cp = ((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63);
      i += 3;
    } else {
      cp =
        ((b & 7) << 18) |
        ((bytes[i + 1] & 63) << 12) |
        ((bytes[i + 2] & 63) << 6) |
        (bytes[i + 3] & 63);
      i += 4;
    }
    codes.push(cp);
    if (codes.length >= 4096) {
      chunks.push(String.fromCodePoint(...codes));
      codes = [];
    }
  }
  chunks.push(String.fromCodePoint(...codes));
  return chunks.join('');
}

export function encryptWithKey(plaintext: string, key: Uint8Array): Envelope {
  const nonce = randomBytes(12);
  const ct = gcm(key, nonce).encrypt(utf8Encode(plaintext));
  return { format: 'networth-enc', v: 1, nonce: toHex(nonce), ct: toHex(ct) };
}

export function decryptWithKey(envelope: Envelope, key: Uint8Array): string {
  try {
    return utf8Decode(gcm(key, fromHex(envelope.nonce)).decrypt(fromHex(envelope.ct)));
  } catch {
    throw new DecryptionError();
  }
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  params: { N: number; r: number; p: number },
): Promise<Uint8Array> {
  return scryptAsync(utf8Encode(password), salt, { ...params, dkLen: 32 });
}

export async function encryptWithPassword(plaintext: string, password: string): Promise<Envelope> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, SCRYPT_PARAMS);
  return {
    ...encryptWithKey(plaintext, key),
    kdf: { name: 'scrypt', ...SCRYPT_PARAMS, salt: toHex(salt) },
  };
}

export async function decryptWithPassword(envelope: Envelope, password: string): Promise<string> {
  if (!envelope.kdf) throw new Error('Envelope is not password protected');
  const { N, r, p, salt } = envelope.kdf;
  const key = await deriveKey(password, fromHex(salt), { N, r, p });
  return decryptWithKey(envelope, key);
}

export function parseEnvelope(text: string): Envelope {
  const parsed = JSON.parse(text);
  if (parsed?.format !== 'networth-enc' || typeof parsed.ct !== 'string') {
    throw new Error('Not a Net Worth encrypted file');
  }
  return parsed as Envelope;
}
