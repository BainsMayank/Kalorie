import { Directory, File, Paths } from 'expo-file-system';

import { uuid } from '@/lib/uuid';

/**
 * Copies a photo of a label into the app's own folder and returns its new address. The camera and
 * the photo picker hand back a temporary copy that the phone may clear; this one stays until the
 * app is removed.
 */
export async function keepLabelPhoto(uri: string): Promise<string> {
  const folder = new Directory(Paths.document, 'labels');
  folder.create({ idempotent: true, intermediates: true });
  const extension = uri.match(/\.(jpe?g|png|heic|webp)$/i)?.[1]?.toLowerCase() ?? 'jpg';
  const target = new File(folder, `${uuid()}.${extension}`);
  await new File(uri).copy(target);
  return target.uri;
}
