import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Database client.
 *
 * Postgres locally (Laragon) and in production (Neon, Supabase, anything) —
 * same driver, same SQL, so nothing about the app changes when it deploys.
 *
 * Next.js dev reloads modules on every edit, which would otherwise open a new
 * pool each time until Postgres refuses connections; the client is cached on
 * globalThis to survive that.
 */
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

const client =
  globalForDb.pg ??
  postgres(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/preflight', {
    max: 10,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.pg = client;

export const db = drizzle(client, { schema });
export { schema };
