/**
 * Verifies the real services are wired up, from your .env, without starting the
 * app:
 *
 *   npm run check:integrations
 *
 * Each section is skipped (not failed) when its credentials are absent, so it is
 * safe to run at any stage. It never prints a key. The ElevenLabs section does a
 * round trip — speaks an Urdu sentence, then transcribes that audio — which
 * spends a few hundred characters of TTS credit and a few seconds of STT.
 */

import { sql } from 'drizzle-orm';

import { getDb } from '../db/client';
import { provider as elevenlabs } from '../lib/ai/elevenlabs';
import { speak } from '../lib/ai/speech';
import { env, hasElevenLabs, hasSupabaseStorage } from '../lib/env';
import { deleteMedia, storeMedia } from '../lib/storage';

let passed = 0;
let failed = 0;
let skipped = 0;

const pass = (label: string, extra = '') => {
  passed++;
  console.log(`  PASS  ${label}${extra ? `  (${extra})` : ''}`);
};
const fail = (label: string, why: unknown) => {
  failed++;
  console.log(`  FAIL  ${label}\n        ${String((why as Error)?.message ?? why).slice(0, 400)}`);
};
const skip = (label: string, why: string) => {
  skipped++;
  console.log(`  SKIP  ${label}  (${why})`);
};

async function checkDatabase() {
  console.log('\nDatabase');
  const handle = await getDb();
  const where = process.env.DATABASE_URL ? 'DATABASE_URL (Postgres)' : 'embedded PGlite';
  if (handle.driver === 'pglite') {
    skip('Supabase Postgres', 'DATABASE_URL is not set; running on embedded PGlite');
  }
  try {
    await handle.db.execute(sql`select 1`);
    pass(`connected via ${where}`, `driver=${handle.driver}`);
  } catch (err) {
    // Drizzle hides the driver error one or two `.cause`s down.
    let root: unknown = err;
    for (let i = 0; i < 5 && (root as { cause?: unknown })?.cause; i++) root = (root as { cause: unknown }).cause;
    const r = root as { code?: string; message?: string };
    const host = (() => {
      try {
        return new URL(process.env.DATABASE_URL ?? '').hostname;
      } catch {
        return '';
      }
    })();
    const unreachable = ['ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'ETIMEDOUT'].includes(r.code ?? '');
    const hint =
      unreachable && /^db\..+\.supabase\.co$/.test(host)
        ? '\n        HINT: that is the Supabase DIRECT host, which is IPv6-only and unreachable from most home' +
          '\n        networks. In Supabase click Connect, copy the "Session pooler" string instead, and use it' +
          '\n        as DATABASE_URL (host looks like aws-0-<region>.pooler.supabase.com).'
        : '';
    fail(`connect via ${where}`, `${r.code ?? ''} ${r.message ?? err}`.trim() + hint);
    return;
  }

  try {
    const res = (await handle.db.execute(
      sql`select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name in ('workers','jobs','customers','trades')`,
    )) as unknown as { rows?: Array<{ n: number }> } | Array<{ n: number }>;
    const rows = Array.isArray(res) ? res : (res.rows ?? []);
    const n = Number(rows[0]?.n ?? 0);
    if (n === 4) pass('schema is migrated (workers, jobs, customers, trades exist)');
    else fail('schema is migrated', `found ${n}/4 core tables — run \`npm run db:migrate\``);
  } catch (err) {
    fail('read schema', err);
  }
  await handle.close();
}

async function checkStorage() {
  console.log('\nSupabase Storage');
  if (!hasSupabaseStorage()) {
    skip('upload + public fetch', 'SUPABASE_URL / SUPABASE_SERVICE_KEY not set (uploads use local disk)');
    return;
  }
  const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]); // "RIFF....WAVE"
  try {
    const stored = await storeMedia(bytes, 'audio/wav');
    if (stored.driver !== 'supabase') {
      fail('upload to Supabase', stored.fallbackReason ?? 'fell back to local disk');
      return;
    }
    pass(`uploaded to bucket "${env.SUPABASE_BUCKET}"`, `${stored.bytes} bytes`);
    const res = await fetch(stored.url);
    const back = new Uint8Array(await res.arrayBuffer());
    if (res.ok && back.byteLength === bytes.byteLength) pass('public URL serves the same bytes');
    else fail('public URL serves the same bytes', `HTTP ${res.status}, ${back.byteLength} bytes`);
    await deleteMedia(stored);
    pass('cleaned up the test object');
  } catch (err) {
    fail('upload to Supabase', err);
  }
}

async function checkElevenLabs() {
  console.log('\nElevenLabs');
  if (!hasElevenLabs()) {
    skip('text-to-speech + speech-to-text', 'ELEVENLABS_API_KEY not set');
    return;
  }

  const sentence = 'آپ کیا کام کرتے ہیں؟ میں بجلی کا کام کرتا ہوں۔';
  let audio: Buffer | undefined;

  try {
    const spoken = await speak(sentence);
    audio = spoken.audio;
    if (spoken.audio.byteLength > 1000) pass('text-to-speech returned audio', `${spoken.model}, ${spoken.audio.byteLength} bytes, ${spoken.cached ? 'cached' : 'live'}`);
    else fail('text-to-speech returned audio', `only ${spoken.audio.byteLength} bytes`);
  } catch (err) {
    fail(`text-to-speech (model ${env.ELEVENLABS_TTS_MODEL}, voice ${env.ELEVENLABS_VOICE_ID})`, err);
  }

  if (!audio) {
    skip('speech-to-text round trip', 'no audio to transcribe');
    return;
  }

  try {
    const out = await elevenlabs.transcribe!({ audio: new Uint8Array(audio), mimeType: 'audio/mpeg', language: 'ur' });
    pass('speech-to-text (Scribe) transcribed it', `${out.meta.model}, ${out.meta.latencyMs}ms, confidence ${out.result.confidence.toFixed(2)}`);
    console.log(`        said:      ${sentence}`);
    console.log(`        heard:     ${out.result.textUr}`);
    console.log(`        roman:     ${out.result.textRoman}`);
  } catch (err) {
    fail(`speech-to-text (model ${env.ELEVENLABS_STT_MODEL})`, err);
  }
}

async function main() {
  console.log('Roshan Rozgar — integration check');
  console.log('='.repeat(50));
  await checkDatabase();
  await checkStorage();
  await checkElevenLabs();
  console.log(`\n${'='.repeat(50)}\n${passed} passed, ${failed} failed, ${skipped} skipped`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('Integration check crashed:', err);
  process.exit(1);
});
