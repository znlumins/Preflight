/**
 * Call metering.
 *
 * The whole "free AI" bet rests on knowing exactly how many requests and tokens
 * one plan costs, because free tiers are rationed per request AND per token.
 * So every model call in the pipeline goes through here, from day one.
 */

export type CallMetric = {
  stage: string;
  model: string;
  /** Which tier asked for this call. Survives model fallback, so quota maths stays correct. */
  tier: 'fast' | 'deep';
  ms: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  totalTokens: number;
  ok: boolean;
  error?: string;
};

export type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  inputTokenDetails?: { cacheReadTokens?: number };
};

export class Meter {
  readonly calls: CallMetric[] = [];

  async track<T extends { usage?: Usage }>(
    stage: string,
    model: string,
    tier: 'fast' | 'deep',
    fn: () => Promise<T>,
  ): Promise<T> {
    const started = Date.now();
    try {
      const result = await fn();
      const u = result.usage ?? {};
      this.calls.push({
        stage,
        model,
        tier,
        ms: Date.now() - started,
        inputTokens: u.inputTokens ?? 0,
        outputTokens: u.outputTokens ?? 0,
        cachedInputTokens: u.inputTokenDetails?.cacheReadTokens ?? 0,
        totalTokens: u.totalTokens ?? (u.inputTokens ?? 0) + (u.outputTokens ?? 0),
        ok: true,
      });
      return result;
    } catch (err) {
      this.calls.push({
        stage,
        model,
        tier,
        ms: Date.now() - started,
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        totalTokens: 0,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  get totals() {
    const sum = (pick: (c: CallMetric) => number) =>
      this.calls.reduce((acc, c) => acc + pick(c), 0);
    return {
      requests: this.calls.length,
      failed: this.calls.filter((c) => !c.ok).length,
      inputTokens: sum((c) => c.inputTokens),
      outputTokens: sum((c) => c.outputTokens),
      cachedInputTokens: sum((c) => c.cachedInputTokens),
      totalTokens: sum((c) => c.totalTokens),
      ms: sum((c) => c.ms),
    };
  }
}
