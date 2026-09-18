import { NextResponse } from 'next/server';
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
 * Runs a pipeline stage and flushes its metering, whether it succeeded or not —
 * a failed call still spent quota, so it still belongs in the log.
 */
export async function withUsage<T>(
  pipeline: Pipeline,
  sessionId: string,
  planId: string | null,
  byok: boolean,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } finally {
    await recordUsage(pipeline.meter, sessionId, planId, byok).catch(() => {});
  }
}

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
  return raw.slice(0, 300);
}
