/**
 * Customers.
 *
 * Deliberately thin. Identity is out of scope per the brief (no verification
 * against government databases), and auth is a mocked phone + PIN disclosed in
 * the README — so this exists to let the customer side of the demo address a
 * real row, not to model accounts properly.
 */

import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { customers } from '@/db/schema';
import { ApiError, body, handle, ok, query } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const listQuery = z.object({
  phone: z.string().min(4).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = handle(async (req: Request) => {
  const { phone, limit } = query(req, listQuery);
  const database = await db();

  const rows = phone
    ? await database.select().from(customers).where(eq(customers.phone, phone)).limit(limit)
    : await database.select().from(customers).orderBy(desc(customers.createdAt)).limit(limit);

  return ok(rows, { count: rows.length });
});

const createBody = z.object({
  name: z.string().min(2).max(80),
  phone: z.string().min(7).max(20),
  pin: z.string().regex(/^\d{4}$/).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  addressLabel: z.string().min(2).max(120),
});

export const POST = handle(async (req: Request) => {
  const input = await body(req, createBody);
  const database = await db();

  const existing = await database
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.phone, input.phone))
    .limit(1);

  if (existing.length) {
    throw new ApiError('CONFLICT', 'A customer with that phone number already exists.');
  }

  const [row] = await database.insert(customers).values(input).returning();
  return ok(row);
});
