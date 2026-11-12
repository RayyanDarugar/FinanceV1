export interface Usage {
  inputTokens: number;
  outputTokens: number;
  searches: number;
  fetches: number;
  /** Actual LLM spend, priced per call at the model that served it. */
  costUsd: number;
}

export const newUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0, searches: 0, fetches: 0, costUsd: 0 });

/** $ per million tokens (input, output). Anthropic first-party rates. */
const RATES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

export function priceTokens(model: string, input: number, output: number): number {
  const [i, o] = RATES[model] ?? RATES["claude-opus-5-5"];
  return (input * i + output * o) / 1_000_000;
}

/** Cost of a token count at one model's rates (used for estimates and tests). */
export function estimateCostUsd(u: Pick<Usage, "inputTokens" | "outputTokens">, model: string = llmModel()): number {
  return priceTokens(model, u.inputTokens, u.outputTokens);
}

/** Judgment calls (scoring, settings): the most capable model unless overridden. */
export function llmModel(): string {
  return process.env.LLM_MODEL || "claude-opus-5-5";
}

/** Bulk page reading: a much cheaper model (design §8 allows one for bulk work). */
export function extractModel(): string {
  return process.env.LLM_EXTRACT_MODEL || "claude-haiku-5-5";
}

export function llmBudgetUsd(): number {
  return Number(process.env.LLM_BUDGET_USD || "2");
}
