/**
 * GET /api/upload/[name]
 *
 * Serves locally stored media files from .data/uploads.
 * Automatically sets Content-Type, Content-Length, and long cache headers.
 */

import { NextResponse } from 'next/server';
import { ApiError, handle } from '@/lib/http';
import { getLocalUpload } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ name: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { name } = await ctx.params;
  if (!name) {
    throw new ApiError('BAD_REQUEST', 'Missing file name parameter.');
  }

  const file = await getLocalUpload(name);
  if (!file) {
    throw new ApiError('NOT_FOUND', 'File not found.');
  }

  return new NextResponse(file.buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': file.mimeType,
      'Content-Length': String(file.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      // This endpoint serves user-uploaded bytes from our own origin. The
      // Content-Type above is derived from the extension against an
      // allow-list, but nosniff stops a browser from second-guessing it and
      // executing something as HTML or script.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
});
