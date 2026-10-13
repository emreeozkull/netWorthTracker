import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import { parseAppData } from '@/domain/schema';
import type { AppData } from '@/domain/types';

import { decryptWithKey, encryptWithKey, fromHex, parseEnvelope, toHex } from './crypto';
import { randomBytes } from './random';

const KEY_NAME = 'networth.dataKey.v1';
const DATA_FILE = 'networth.enc';

function dataFile(): File {
  return new File(Paths.document, DATA_FILE);
}

/** Random AES key kept in the iOS Keychain / Android Keystore. Created on first use. */
async function getOrCreateKey(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(KEY_NAME);
  if (existing) return fromHex(existing);
  if (dataFile().exists) {
    // Data without its key can never be decrypted; refuse rather than silently overwrite it.
    throw new Error('Encryption key is missing for existing data. Restore from a backup.');
  }
  const key = randomBytes(32);
  await SecureStore.setItemAsync(KEY_NAME, toHex(key));
  return key;
}

export async function loadData(): Promise<AppData | null> {
  const file = dataFile();
  if (!file.exists) return null;
  const key = await getOrCreateKey();
  const json = decryptWithKey(parseEnvelope(await file.text()), key);
  return parseAppData(JSON.parse(json));
}

export async function saveData(data: AppData): Promise<void> {
  const key = await getOrCreateKey();
  const envelope = encryptWithKey(JSON.stringify(data), key);
  const file = dataFile();
  if (!file.exists) file.create();
  file.write(JSON.stringify(envelope));
}

/** Removes the data file and its key. Irreversible. */
export async function wipeData(): Promise<void> {
  const file = dataFile();
  if (file.exists) file.delete();
  await SecureStore.deleteItemAsync(KEY_NAME);
}
