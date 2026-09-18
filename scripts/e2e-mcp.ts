import { config as loadEnv } from 'dotenv';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

/**
 * MCP checks, driven by a real MCP client rather than raw HTTP.
 *
 * Using the SDK client means the protocol handshake, tool discovery and call
 * envelopes are all exercised the way Claude Code or Cursor would exercise
 * them — a curl that returns 200 proves much less.
 *
 *   npx tsx scripts/e2e-mcp.ts
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const REAL_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '';

let cookie = '';

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...init?.headers },
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return { status: res.status, body: { raw: text } as Record<string, unknown> };
  }
}

const results: { label: string; ok: boolean }[] = [];
const check = (label: string, ok: boolean, detail = '') => {
  results.push({ label, ok });
  console.log(`  ${ok ? 'ok  ' : 'GAGAL'} ${label}${detail ? ` — ${detail}` : ''}`);
};

function connect(token: string) {
  const client = new Client({ name: 'preflight-e2e', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/api/mcp/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { client, transport };
}

/** Tool results come back as JSON in a text block. */
function parse(result: unknown) {
  const content = (result as { content: { type: string; text: string }[] }).content;
  return JSON.parse(content[0].text);
}

async function main() {
  if (!REAL_KEY) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY belum diisi.');

  await call('/api/key', {
    method: 'PUT',
    body: JSON.stringify({ provider: 'google', apiKey: REAL_KEY }),
  });

  console.log('\n=== menyiapkan rencana ===\n');
  const idea = 'Aplikasi untuk laundry kiloan: terima order, hitung berat dan harga, lacak status cucian.';
  const q = await call('/api/plan/questions', {
    method: 'POST',
    body: JSON.stringify({ idea, context: 'Sendirian, 4 minggu, budget nol.', language: 'id' }),
  });
  const created = await call('/api/plan/create', {
    method: 'POST',
    body: JSON.stringify({ idea, language: 'id', questions: q.body, answers: [] }),
  });
  const planId = created.body.planId as string;
  for (const stage of ['features', 'specs', 'tasks']) {
    await call(`/api/plan/${planId}/${stage}`, { method: 'POST' });
  }
  const plan = (await call(`/api/plan/${planId}`)).body as unknown as {
    plan: { status: string; title: string };
    tasks: { id: string; done: boolean }[];
  };
  check('rencana siap', plan.plan.status === 'done', `${plan.tasks.length} task`);

  console.log('\n=== token ===\n');
  const statusBefore = await call('/api/agent-token');
  check('belum ada token', statusBefore.body === null);

  const issued = await call('/api/agent-token', { method: 'POST' });
  const token = issued.body.token as string;
  check('token terbit', !!token && token.startsWith('pf_'), `…${token?.slice(-4)}`);

  const statusAfter = await call('/api/agent-token');
  check(
    'GET tidak mengembalikan token mentah',
    !JSON.stringify(statusAfter.body).includes(token.slice(8)),
  );

  console.log('\n=== tanpa token, harus ditolak ===\n');
  try {
    const { client, transport } = connect('pf_jelas-salah-sekali');
    await client.connect(transport);
    await client.close();
    check('token palsu ditolak', false, 'malah berhasil connect');
  } catch {
    check('token palsu ditolak', true);
  }

  console.log('\n=== klien MCP sungguhan ===\n');
  const { client, transport } = connect(token);
  await client.connect(transport);
  check('handshake MCP berhasil', true);

  const tools = await client.listTools();
  const names = tools.tools.map((t) => t.name).sort();
  check('tool terdaftar', names.length === 3, names.join(', '));

  // Tool definitions live in the agent's context for the whole conversation,
  // so their size is a budget worth watching, not an afterthought.
  const defBytes = JSON.stringify(tools.tools).length;
  check('definisi tool tetap ramping', defBytes < 4000, `${defBytes} byte (~${Math.round(defBytes / 4)} token)`);

  const status = parse(await client.callTool({ name: 'preflight_plan_status', arguments: {} }));
  check('plan_status menemukan rencana terbaru', status.plan?.id === planId, status.plan?.title);
  check('progres dilaporkan', status.total === plan.tasks.length, `${status.done}/${status.total}`);

  const first = parse(await client.callTool({ name: 'preflight_next_task', arguments: {} }));
  check('next_task memberi task', !!first.task?.id, first.task?.title);
  check(
    'task membawa instruksi siap jalan',
    (first.task?.instruction?.length ?? 0) > 180,
    `${first.task?.instruction?.length} karakter`,
  );

  const done = parse(
    await client.callTool({
      name: 'preflight_complete_task',
      arguments: { taskId: first.task.id },
    }),
  );
  check('complete_task menandai selesai', done.remaining === first.remaining - 1, `sisa ${done.remaining}`);

  const second = parse(await client.callTool({ name: 'preflight_next_task', arguments: {} }));
  check('task berikutnya berbeda dari yang tadi', second.task?.id !== first.task.id, second.task?.title);

  // What the agent does is what the person sees.
  const web = (await call(`/api/plan/${planId}`)).body as unknown as {
    tasks: { id: string; done: boolean }[];
  };
  check(
    'yang ditandai agent muncul di aplikasi web',
    web.tasks.find((t) => t.id === first.task.id)?.done === true,
  );

  const bogus = parse(
    await client.callTool({
      name: 'preflight_complete_task',
      arguments: { taskId: 'task-yang-tidak-pernah-ada' },
    }),
  );
  check('task ngawur ditolak, bukan diam-diam lolos', !!bogus.error, String(bogus.error ?? ''));

  await client.close();

  console.log('\n=== token dicabut ===\n');
  await call('/api/agent-token', { method: 'DELETE' });
  try {
    const again = connect(token);
    await again.client.connect(again.transport);
    await again.client.close();
    check('token yang dicabut tidak bisa dipakai lagi', false, 'malah masih bisa');
  } catch {
    check('token yang dicabut tidak bisa dipakai lagi', true);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} lolos${failed.length ? ` — ${failed.length} GAGAL` : ''}\n`,
  );
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error('\nGAGAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
