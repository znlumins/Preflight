import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { Pipeline } from './ai/pipeline';
import { credentialsFor } from './keys';
import { recordUsage } from './plans';

/**
 * Shared plumbing for the plan routes.
 */

/**
 * Builds the pipeline for a session, on that session's own key when it has one.
 *
 * Tiering follows whose quota pays. On the shared pool the deep tier is off,
 * because Google's full Flash models allow only ~20 free requests a day against
 * Flash-Lite's ~500 — using it would cap the whole product at ~10 plans daily.
 * Someone spending their own quota gets the better model for the PRD.
 */
export async function pipelineFor(sessionId: string) {
  const { creds, byok } = await credentialsFor(sessionId);
  return { pipeline: new Pipeline(creds, { singleTier: !byok }), byok };
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Parses and validates a JSON body.
 *
 * A body that is not JSON, or not the right shape, is the client's mistake and
 * gets a 400 with the first problem found — not a 500 from an unhandled throw.
 */
export async function readBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<{ data: z.infer<S>; error?: never } | { data?: never; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: bad('Payload bukan JSON yang valid.') };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // A body that is not even an object has no field to blame.
    const message = issue && issue.path.length ? issue.message : 'Payload tidak valid.';
    return { error: bad(message) };
  }
  return { data: parsed.data };
}

export type UsageContext = {
  sessionId: string;
  ipHash: string | null;
  planId: string | null;
  byok: boolean;
  /**
   * Prepended to every logged stage name. The revision route uses it so the
   * pipeline stages it runs to fill in an added feature count against the
   * revision allowance rather than looking like plan generation.
   */
  stagePrefix?: string;
};

/**
 * Runs a pipeline stage and flushes its metering, whether it succeeded or not —
 * a failed call still spent quota, so it still belongs in the log.
 */
export async function withUsage<T>(
  pipeline: Pipeline,
  ctx: UsageContext,
  run: () => Promise<T>,
): Promise<T> {
  const from = pipeline.meter.calls.length;
  try {
    return await run();
  } finally {
    // Only the calls made by this run: a pipeline reused across several
    // `withUsage` blocks must not log its earlier calls twice.
    await recordUsage(pipeline.meter.calls.slice(from), ctx).catch((err) =>
      console.error('recordUsage failed:', err),
    );
  }
}

/**
 * What the user is told when a stage fails.
 *
 * Known failure kinds get a sentence that says what to do next. Anything else
 * is logged and replaced with a generic message: a raw error can carry a SQL
 * statement, a hostname or a provider payload, none of which belong in the
 * browser.
 */
export function errorMessage(err: unknown, byok: boolean): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (/quota|rate limit|exhausted|429/i.test(raw)) {
    return byok
      ? 'Kuota API key kamu untuk hari ini sudah habis. Coba lagi besok.'
      : 'Kuota AI gratis bersama untuk hari ini sudah habis. Pasang API key kamu sendiri untuk lanjut sekarang — gratis, ambil di Google AI Studio.';
  }
  if (/high demand|overload|unavailable|503/i.test(raw)) {
    return 'Model AI sedang penuh. Coba lagi sebentar lagi.';
  }
  if (/api key|API_KEY_INVALID|401|403/i.test(raw)) {
    return 'API key ditolak provider. Cek lagi di pengaturan.';
  }
  if (/no object generated|could not parse|did not match|schema|validation/i.test(raw)) {
    return 'Jawaban model AI tidak bisa dipakai kali ini. Coba lagi.';
  }
  if (/timeout|timed out|aborted/i.test(raw)) {
    return 'Model AI terlalu lama menjawab. Coba lagi.';
  }

  console.error('Unclassified stage error:', err);
  return 'Ada yang gagal di server. Coba lagi sebentar lagi.';
}
