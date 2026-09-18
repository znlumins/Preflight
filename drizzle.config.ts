import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { databaseUrl } from './lib/db/url';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

/**
 * Schema changes go through Supabase's session-mode pooler (:5432) rather
 * than the transaction-mode one (:6543) the app uses: drizzle-kit relies on
 * prepared statements, which transaction mode does not support.
 */
function migrationUrl(url: string): string {
  return url.includes('pooler.supabase.com:6543')
    ? url.replace('pooler.supabase.com:6543', 'pooler.supabase.com:5432')
    : url;
}

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: migrationUrl(databaseUrl()),
  },
});
