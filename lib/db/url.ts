/**
 * Which database this process talks to.
 *
 * `DB_TARGET` is the switch, and it defaults to local so production is only
 * ever reached on purpose:
 *
 *   local (default)  DATABASE_URL, else the Laragon default
 *   prod             DATABASE_URL_PROD — set it in .env.local, then run the
 *                    `:prod` npm scripts (`npm run dev:prod`, `db:push:prod`)
 *
 * On Vercel `DB_TARGET` is unset and `DATABASE_URL` is the production URL, so
 * deployments take the default branch.
 */
export const LOCAL_DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:5432/preflight';

export type DbTarget = 'local' | 'prod';

export function dbTarget(): DbTarget {
  const raw = process.env.DB_TARGET;
  if (raw === undefined || raw === '' || raw === 'local') return 'local';
  if (raw === 'prod') return 'prod';
  // A typo must not silently fall back to one database or the other.
  throw new Error(`DB_TARGET must be "local" or "prod", got "${raw}".`);
}

export function databaseUrl(): string {
  if (dbTarget() === 'prod') {
    const url = process.env.DATABASE_URL_PROD;
    if (!url) {
      throw new Error(
        'DB_TARGET=prod but DATABASE_URL_PROD is not set. Add the production ' +
          'connection string to .env.local (it is gitignored).',
      );
    }
    return url;
  }
  return process.env.DATABASE_URL ?? LOCAL_DATABASE_URL;
}
