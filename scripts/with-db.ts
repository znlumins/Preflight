/**
 * Runs a command against a chosen database: `tsx scripts/with-db.ts <local|prod> <command...>`.
 *
 * Exists because npm scripts run under cmd.exe on Windows, where the
 * `DB_TARGET=prod next dev` prefix syntax does not work.
 */
import { spawn } from 'node:child_process';

const [target, ...command] = process.argv.slice(2);

if ((target !== 'local' && target !== 'prod') || command.length === 0) {
  console.error('Usage: tsx scripts/with-db.ts <local|prod> <command...>');
  process.exit(1);
}

if (target === 'prod') {
  console.warn('\n\x1b[41m\x1b[97m PRODUCTION DATABASE \x1b[0m every write lands on real user data.\n');
}

const child = spawn(command.join(' '), {
  shell: true,
  stdio: 'inherit',
  env: { ...process.env, DB_TARGET: target },
});

child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
