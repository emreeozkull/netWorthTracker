import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { localDateKey } from '@/domain/snapshot';

/** Writes the backup to the cache directory and opens the system share sheet. */
export async function shareBackupFile(contents: string): Promise<void> {
  const file = new File(Paths.cache, `networth-${localDateKey()}.nwbackup`);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  // The file is left in the cache: on Android the receiving app may read it after shareAsync
  // resolves. It is password-encrypted and replaced on the next export.
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Net Worth backup',
  });
}

/** Lets the user pick a backup file. Returns its contents, or null if cancelled. */
export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  const file = new File(result.assets[0].uri);
  try {
    return await file.text();
  } finally {
    if (file.exists) file.delete();
  }
}
