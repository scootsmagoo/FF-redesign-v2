import { env } from 'cloudflare:workers';

/**
 * Image storage for the manager: files live in the IMAGES R2 bucket and are served by
 * `/images/{key}` (src/pages/images/[...key].ts). Keys mirror the legacy folder layout so the
 * eventual ProdImages migration lands in the same place:
 *   products/{sku-ish}.jpg      product photos (legacy ProdImages/)
 *   categories/…                category graphics/logos (legacy images/cat/)
 *   options/…                   option swatches
 *   content/…                   banners, support images, misc uploads (legacy images/)
 */

type Bindings = { IMAGES?: R2Bucket; SITE_URL?: string };
const bindings = env as unknown as Bindings;

export const IMAGE_FOLDERS = ['products', 'categories', 'options', 'brands', 'content'] as const;
export type ImageFolder = (typeof IMAGE_FOLDERS)[number];

const TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', pdf: 'application/pdf' };

export function bucket(): R2Bucket {
  if (!bindings.IMAGES) throw new Error('The IMAGES R2 bucket is not bound');
  return bindings.IMAGES;
}

export function contentTypeFor(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  return TYPES[ext] ?? 'application/octet-stream';
}

/** lower-case, safe characters only, keeps the extension; "20x25x1 MERV 8.JPG" → "20x25x1-merv-8.jpg" */
export function safeFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  const ext = (dot > 0 ? name.slice(dot + 1) : '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!base) throw new Error('File name is empty');
  if (!TYPES[ext]) throw new Error(`Unsupported file type ".${ext}" (allowed: ${Object.keys(TYPES).join(', ')})`);
  return `${base}.${ext}`;
}

export function imageKey(folder: ImageFolder, fileName: string): string {
  if (!IMAGE_FOLDERS.includes(folder)) throw new Error('Unknown image folder');
  return `${folder}/${safeFileName(fileName)}`;
}

/** Public URL of a stored key (site-relative; absolute when SITE_URL is known). */
export function imageUrl(key: string, absolute = false): string {
  const path = `/images/${key.split('/').map(encodeURIComponent).join('/')}`;
  return absolute && bindings.SITE_URL ? `${bindings.SITE_URL.replace(/\/+$/, '')}${path}` : path;
}

export async function putImage(folder: ImageFolder, file: File, opts: { overwrite?: boolean; name?: string } = {}): Promise<{ key: string; url: string; size: number }> {
  if (!file.size) throw new Error('The file is empty');
  if (file.size > 10 * 1024 * 1024) throw new Error('Images must be 10 MB or smaller');
  const key = imageKey(folder, opts.name ?? file.name);
  const b = bucket();
  if (!opts.overwrite && (await b.head(key))) throw new Error(`${key} already exists; tick "replace" to overwrite it`);
  await b.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: contentTypeFor(key), cacheControl: 'public, max-age=31536000, immutable' } });
  return { key, url: imageUrl(key), size: file.size };
}

export async function deleteImage(key: string): Promise<void> {
  await bucket().delete(key);
}

export interface StoredImage {
  key: string;
  url: string;
  size: number;
  uploaded: string;
}

export async function listImages(folder: ImageFolder | '', opts: { cursor?: string; limit?: number; search?: string } = {}): Promise<{ items: StoredImage[]; cursor: string | null }> {
  const prefix = folder ? `${folder}/${(opts.search ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-')}` : '';
  const r = await bucket().list({ prefix, cursor: opts.cursor, limit: opts.limit ?? 100 });
  return {
    items: r.objects.map((o) => ({ key: o.key, url: imageUrl(o.key), size: o.size, uploaded: o.uploaded.toISOString() })),
    cursor: r.truncated ? r.cursor : null,
  };
}

export async function imageExists(key: string): Promise<boolean> {
  return Boolean(await bucket().head(key));
}
