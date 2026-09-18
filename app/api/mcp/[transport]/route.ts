import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';
import { sessionForToken } from '@/lib/agent-token';
import { completeTask, nextTask, planStatus } from '@/lib/agent-tools';

/**
 * MCP server: the plan, as a work queue an agent can pull from.
 *
 * Three tools, no more. Every definition here is loaded into the agent's
 * context for the whole conversation, so this is a budget, not a menu.
 *
 * No model is called from any of these — they read and write rows that already
 * exist, at roughly 0.05 ms of database time each. The expensive part of this
 * product is generating a plan; working through one is nearly free.
 */

const planIdArg = z
  .string()
  .optional()
  .describe('Plan id. Omit to use the most recently updated plan.');

const json = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'preflight_next_task',
      {
        title: 'Ambil task berikutnya',
        description:
          'Returns the next unfinished task from the user\'s Preflight plan, including a ' +
          'self-contained instruction to carry it out. Call this to start work, and again ' +
          'after each completed task. Tasks come back in build order, so the one returned is ' +
          'the one to do next.',
        inputSchema: z.object({ planId: planIdArg }),
      },
      async ({ planId }, ctx) => {
        const sessionId = ctx.http?.authInfo?.extra?.sessionId as string | undefined;
        if (!sessionId) return json({ error: 'Token tidak valid.' });
        return json(await nextTask(sessionId, planId));
      },
    );

    server.registerTool(
      'preflight_complete_task',
      {
        title: 'Tandai task selesai',
        description:
          'Marks one task as done and reports how many remain. Call this only after the work ' +
          'is actually finished and verified, not when starting it.',
        inputSchema: z.object({
          taskId: z.string().describe('The id from preflight_next_task.'),
          planId: planIdArg,
        }),
        annotations: { destructiveHint: false, idempotentHint: true },
      },
      async ({ taskId, planId }, ctx) => {
        const sessionId = ctx.http?.authInfo?.extra?.sessionId as string | undefined;
        if (!sessionId) return json({ error: 'Token tidak valid.' });
        return json(await completeTask(sessionId, taskId, planId));
      },
    );

    server.registerTool(
      'preflight_plan_status',
      {
        title: 'Lihat progres rencana',
        description:
          'Summarises the plan: its title, how many tasks are done, and progress per feature. ' +
          'Use it to report progress or to find the plan id when the user has several.',
        inputSchema: z.object({ planId: planIdArg }),
        annotations: { readOnlyHint: true },
      },
      async ({ planId }, ctx) => {
        const sessionId = ctx.http?.authInfo?.extra?.sessionId as string | undefined;
        if (!sessionId) return json({ error: 'Token tidak valid.' });
        return json(await planStatus(sessionId, planId));
      },
    );
  },
  {
    serverInfo: { name: 'preflight', version: '1.0.0' },
    instructions:
      'Preflight holds a build plan: ordered tasks, each with a ready-to-run instruction. ' +
      'Work the queue — take a task, do it, verify it, mark it done, take the next. ' +
      'Do not invent work that is not in the plan.',
    // No server-initiated streams, so no connection is held open per agent.
    // This is what keeps the server cost of an idle agent at zero.
    maxSubscriptions: 0,
  },
);

/**
 * Bearer auth.
 *
 * The token maps to one anonymous session, which is the same boundary the web
 * app uses — an agent can reach exactly the plans its owner can, and nothing
 * else.
 */
const authenticated = withMcpAuth(
  handler,
  async (_req, bearerToken) => {
    const sessionId = await sessionForToken(bearerToken);
    if (!sessionId) return undefined;

    return {
      token: bearerToken!,
      scopes: ['plan:read', 'plan:write'],
      clientId: sessionId,
      extra: { sessionId },
    };
  },
  { required: true },
);

export { authenticated as GET, authenticated as POST, authenticated as DELETE };
