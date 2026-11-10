/**
 * GET /api/upload/:name — serves media saved to LOCAL disk by POST /api/upload.
 *
 * Only names this app generated are served (strict pattern, no path
 * separators), so this cannot be used to read arbitrary files. Media stored in
 * Supabase is served by Supabase directly and never reaches this route.
 */

import { NextResponse } from 'next/server';

import { ApiError, handle } from '@/lib/http';
import { mimeForName, readLocal } from '@/lib/storage';

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ name: string }> }) => {
  const { name } = await ctx.params;
  const bytes = await readLocal(name);
  if (!bytes) throw new ApiError('NOT_FOUND', 'No such file.');

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'content-type': mimeForName(name),
      'content-length': String(bytes.byteLength),
      // Names are random UUIDs and never reused, so the content is immutable.
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
});
