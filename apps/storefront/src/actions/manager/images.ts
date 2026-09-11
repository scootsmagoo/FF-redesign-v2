import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { deleteImage, IMAGE_FOLDERS, putImage, type ImageFolder } from '~/lib/manager/images';
import { requireArea } from '~/lib/manager/permissions';

const folder = z.enum(IMAGE_FOLDERS);

/** Image library (legacy sa_image_management / FileManager): files live in the IMAGES R2 bucket. */
export const imageActions = {
  uploadImages: defineAction({
    accept: 'form',
    input: z.object({ folder, files: z.array(z.instanceof(File)).min(1), overwrite: z.boolean().default(false), name: z.string().trim().max(120).nullish() }),
    handler: async ({ folder: f, files, overwrite, name }, ctx) => {
      requireArea(ctx, 'ProductImages', 1);
      const results: { key: string; url: string; size: number }[] = [];
      const errors: string[] = [];
      for (const file of files) {
        if (!file.size) continue;
        try {
          results.push(await putImage(f as ImageFolder, file, { overwrite, name: files.length === 1 && name ? name : undefined }));
        } catch (e) {
          errors.push(`${file.name}: ${e instanceof Error ? e.message : 'failed'}`);
        }
      }
      if (!results.length) throw new ActionError({ code: 'BAD_REQUEST', message: errors.join(' ') || 'No files were uploaded.' });
      return { ok: true, uploaded: results, errors };
    },
  }),

  deleteImage: defineAction({
    accept: 'form',
    input: z.object({ key: z.string().min(3).max(300) }),
    handler: async ({ key }, ctx) => {
      requireArea(ctx, 'ProductImages', 1);
      if (key.includes('..') || !IMAGE_FOLDERS.some((f) => key.startsWith(`${f}/`))) throw new ActionError({ code: 'BAD_REQUEST', message: 'Unknown image key.' });
      await deleteImage(key);
      return { ok: true, folder: key.split('/')[0]! };
    },
  }),
};
