import { sql } from 'drizzle-orm';
import { db } from '../lib/db';

async function migrate() {
  console.log('Running auth migration...');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      google_id text NOT NULL UNIQUE,
      email text NOT NULL UNIQUE,
      name text NOT NULL,
      avatar_url text,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    );
  `);
  console.log('Created table users (if not exists)');

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      expires_at timestamp with time zone NOT NULL
    );
  `);
  console.log('Created table user_sessions (if not exists)');

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions(user_id);
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plans' AND column_name = 'user_id'
      ) THEN
        ALTER TABLE plans ADD COLUMN user_id text REFERENCES users(id) ON DELETE SET NULL;
      END IF;
    END
    $$;
  `);
  console.log('Added column user_id to plans (if not exists)');

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS plans_user_idx ON plans(user_id, created_at);
  `);

  console.log('Migration completed successfully!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
