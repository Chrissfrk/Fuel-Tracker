import fs from 'node:fs';
import path from 'node:path';
import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { HttpError, requireUser } from '../app';
import { nextRev } from '../db/client';
import { photos } from '../db/schema';

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const TYPES = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' } as const;
type PhotoType = keyof typeof TYPES;

/** Check the file really is the image type it claims to be. */
function sniff(buf: Buffer): PhotoType | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length > 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buf.length > 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

const idSchema = z.uuid();

export const photoRoutes: FastifyPluginAsync = async (app) => {
  const { db, config } = app;
  const dir = path.join(config.dataDir, 'uploads');

  app.addContentTypeParser(
    Object.keys(TYPES),
    { parseAs: 'buffer', bodyLimit: MAX_PHOTO_BYTES },
    (_req, body, done) => done(null, body),
  );

  /** Upload with a client-generated id, so it can be queued offline and retried safely. */
  app.put<{ Params: { id: string } }>(
    '/photos/:id',
    { preHandler: requireUser, bodyLimit: MAX_PHOTO_BYTES },
    async (req, reply) => {
      const id = idSchema.safeParse(req.params.id);
      if (!id.success) throw new HttpError(400, 'Invalid photo id');
      if (!Buffer.isBuffer(req.body)) throw new HttpError(415, 'Send a JPEG, WebP or PNG image');
      const type = sniff(req.body);
      if (!type) throw new HttpError(415, 'That file is not a JPEG, WebP or PNG image');
      const existing = db.select().from(photos).where(eq(photos.id, id.data)).get();
      if (existing) return { id: existing.id };

      const filename = `${id.data}.${TYPES[type]}`;
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(path.join(dir, filename), req.body);
      const now = Date.now();
      db.insert(photos)
        .values({
          id: id.data,
          filename,
          mimeType: type,
          sizeBytes: req.body.length,
          createdAt: now,
          updatedAt: now,
          createdBy: req.user!.id,
          rev: nextRev(db),
        })
        .onConflictDoNothing() // a retried upload racing the first one
        .run();
      reply.status(201);
      return { id: id.data };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/photos/:id',
    { preHandler: requireUser },
    async (req, reply) => {
      const id = idSchema.safeParse(req.params.id);
      if (!id.success) throw new HttpError(404, 'Photo not found');
      const photo = db.select().from(photos).where(eq(photos.id, id.data)).get();
      if (!photo || photo.deletedAt != null) throw new HttpError(404, 'Photo not found');
      const file = path.join(dir, photo.filename);
      if (!fs.existsSync(file)) throw new HttpError(404, 'Photo file is missing');
      reply.type(photo.mimeType).header('Cache-Control', 'private, max-age=31536000, immutable');
      return reply.send(fs.createReadStream(file));
    },
  );
};
