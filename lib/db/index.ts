import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { databaseUrl, dbTarget } from './url';

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

function createClient() {
  const url = databaseUrl();
  if (dbTarget() === 'prod' && process.env.NODE_ENV !== 'production') {
    console.warn('[db] DB_TARGET=prod — this local server is using the PRODUCTION database.');
  }
  return postgres(url, {
    max: 10,
    // Transaction-mode poolers (Supabase Supavisor on :6543) multiplex one
    // Postgres session across clients, so a named prepared statement would
    // outlive the connection it was made on. Plain queries work everywhere.
    prepare: !url.includes('pooler.supabase.com'),
  });
}

const client = globalForDb.pg ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForDb.pg = client;

export const db = drizzle(client, { schema });
export { schema };
