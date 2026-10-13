import { parseAppData } from '@/domain/schema';
import type { AppData } from '@/domain/types';

import { decryptWithPassword, encryptWithPassword, parseEnvelope } from './crypto';

export const MIN_BACKUP_PASSWORD = 8;

export async function createBackup(data: AppData, password: string): Promise<string> {
  if (password.length < MIN_BACKUP_PASSWORD) throw new Error('Password too short');
  return JSON.stringify(await encryptWithPassword(JSON.stringify(data), password));
}

/** Throws DecryptionError on a wrong password and a zod error on malformed contents. */
export async function readBackup(text: string, password: string): Promise<AppData> {
  const json = await decryptWithPassword(parseEnvelope(text), password);
  return parseAppData(JSON.parse(json));
}
