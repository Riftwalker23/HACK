/**
 * POST /api/auth/login — MOCKED phone + PIN sign-in.
 *
 * Real OTP/SMS delivery and identity verification are out of scope per the
 * brief, so this is a deliberately thin stand-in that lets the two frontends
 * resolve "who am I" for a demo account. It is disclosed in the README as
 * mocked. It issues NO session or token: the client keeps the returned id and
 * passes it to the other endpoints, which do not enforce auth.
 *
 *   body: { phone, pin, role: 'worker' | 'customer' }
 *
 * The same message is returned for "no such phone" and "wrong PIN" so the
 * endpoint cannot be used to enumerate registered numbers.
 */

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db/client';
import { customers, trades, workers } from '@/db/schema';
import { ApiError, body, handle, ok } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const loginBody = z.object({
  phone: z.string().trim().min(7).max(20),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be four digits.'),
  role: z.enum(['worker', 'customer']),
});

const BAD_CREDENTIALS = 'Phone number or PIN is incorrect.';

export const POST = handle(async (req: Request) => {
  const input = await body(req, loginBody);
  const database = await db();

  if (input.role === 'worker') {
    const [row] = await database
      .select({
        id: workers.id,
        name: workers.name,
        phone: workers.phone,
        area: workers.area,
        status: workers.status,
        rating: workers.rating,
        jobsCompleted: workers.jobsCompleted,
        photoUrl: workers.photoUrl,
        tradeSlug: trades.slug,
        tradeNameUr: trades.nameUr,
        tradeNameEn: trades.nameEn,
        tradeColor: trades.color,
        tradeGlyph: trades.glyph,
      })
      .from(workers)
      .innerJoin(trades, eq(trades.id, workers.tradeId))
      .where(and(eq(workers.phone, input.phone), eq(workers.pin, input.pin)))
      .limit(1);

    if (!row) throw new ApiError('UNAUTHORIZED', BAD_CREDENTIALS);
    return ok({ role: 'worker' as const, user: row }, { mocked: true });
  }

  const [row] = await database
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      lat: customers.lat,
      lng: customers.lng,
      addressLabel: customers.addressLabel,
      rating: customers.rating,
    })
    .from(customers)
    .where(and(eq(customers.phone, input.phone), eq(customers.pin, input.pin)))
    .limit(1);

  if (!row) throw new ApiError('UNAUTHORIZED', BAD_CREDENTIALS);
  return ok({ role: 'customer' as const, user: row }, { mocked: true });
});
