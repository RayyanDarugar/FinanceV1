import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { estimateCostUsd, llmModel, type Usage } from "./usage";

/** The slice of the SDK we use, so tests can stand in for it. */
export interface LlmClient {
  parse(params: Record<string, unknown>): Promise<{
    parsed_output: unknown;
    stop_reason: string | null;
    usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null };
  }>;
}

let sdk: Anthropic | null = null;
function defaultClient(): LlmClient {
  sdk ??= new Anthropic({ maxRetries: 2 });
  const client = sdk;
  return {
    parse: (params) => client.messages.parse(params as never) as never,
  };
}

/** Thrown when a run's LLM spend reaches its cap (LLM_BUDGET_USD). */
export class BudgetExceededError extends Error {}

export interface CallJsonOpts<T> {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}

/**
 * One structured-output call. Validates against the zod schema; on a bad/empty/refused response retries once,
 * then returns null — never throws for model problems, so one bad page can't stop a run.
 * Throws BudgetExceededError before calling when this Usage has already spent LLM_BUDGET_USD.
 */
export async function callJson<T>(opts: CallJsonOpts<T>, usage: Usage, client: LlmClient = defaultClient()): Promise<T | null> {
  const budget = Number(process.env.LLM_BUDGET_USD || "2");
  if (estimateCostUsd(usage) >= budget) throw new BudgetExceededError(`LLM budget of $${budget} reached`);

  const params = {
    model: llmModel(),
    max_tokens: opts.maxTokens ?? 8000,
    // Stable instructions first so repeated calls in a run hit the prompt cache.
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.user }],
    output_config: { format: zodOutputFormat(opts.schema as never), effort: opts.effort ?? "low" },
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await client.parse(params);
      usage.inputTokens += (res.usage.input_tokens ?? 0) + (res.usage.cache_read_input_tokens ?? 0);
      usage.outputTokens += res.usage.output_tokens ?? 0;
      if (res.stop_reason === "refusal" || res.parsed_output == null) continue;
      const checked = opts.schema.safeParse(res.parsed_output);
      if (checked.success) return checked.data;
    } catch (e) {
      if (e instanceof BudgetExceededError) throw e;
      console.warn("callJson attempt failed:", e instanceof Error ? e.message : e);
    }
  }
  return null;
}
