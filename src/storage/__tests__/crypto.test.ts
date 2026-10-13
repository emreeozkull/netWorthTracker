/// <reference types="jest" />
/// <reference types="node" />

import { demoData } from '@/domain/demo';
import { parseDecimal } from '@/i18n/format';

import { createBackup, readBackup } from '../backup';
import {
  decryptWithKey,
  DecryptionError,
  encryptWithKey,
  fromHex,
  parseEnvelope,
  toHex,
  utf8Decode,
  utf8Encode,
} from '../crypto';

// jest.mock factories can't reference imports, so node's crypto is required inline.
jest.mock('../random', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  randomBytes: (n: number) => new Uint8Array(require('crypto').randomBytes(n)),
}));

const key = new Uint8Array(32).fill(7);

describe('crypto', () => {
  it('encodes UTF-8 like the platform does', () => {
    const text = 'Çeyrek altın ₺ 💰 net worth';
    expect(Buffer.from(utf8Encode(text)).toString('utf8')).toBe(text);
    expect(utf8Decode(new Uint8Array(Buffer.from(text, 'utf8')))).toBe(text);
  });

  it('round-trips hex', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    expect(fromHex(toHex(bytes))).toEqual(bytes);
  });

  it('encrypts and decrypts with a key, using a fresh nonce each time', () => {
    const a = encryptWithKey('secret ₺', key);
    const b = encryptWithKey('secret ₺', key);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.ct).not.toContain(toHex(utf8Encode('secret')));
    expect(decryptWithKey(a, key)).toBe('secret ₺');
  });

  it('rejects a wrong key or tampered ciphertext', () => {
    const env = encryptWithKey('secret', key);
    expect(() => decryptWithKey(env, new Uint8Array(32))).toThrow(DecryptionError);
    const flipped = env.ct.slice(0, -1) + (env.ct.endsWith('0') ? '1' : '0');
    expect(() => decryptWithKey({ ...env, ct: flipped }, key)).toThrow(DecryptionError);
  });
});

describe('backup', () => {
  it('restores identical data with the right password', async () => {
    const data = demoData();
    const file = await createBackup(data, 'correct horse');
    expect(file).not.toContain('Broker A');
    expect(parseEnvelope(file).kdf?.name).toBe('scrypt');
    expect(await readBackup(file, 'correct horse')).toEqual(data);
  });

  it('rejects the wrong password and short passwords', async () => {
    const file = await createBackup(demoData(), 'correct horse');
    await expect(readBackup(file, 'wrong horse')).rejects.toBeInstanceOf(DecryptionError);
    await expect(createBackup(demoData(), 'short')).rejects.toThrow();
  });

  it('rejects files that are not backups', async () => {
    await expect(readBackup('{"hello":1}', 'whatever1')).rejects.toThrow(/Not a Net Worth/);
  });
});

describe('parseDecimal', () => {
  it.each([
    ['1234.5', 1234.5],
    ['1234,5', 1234.5],
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    [' 0,25 ', 0.25],
    ['', undefined],
    ['abc', undefined],
    ['1.2.3', undefined],
  ])('%s -> %s', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });
});
