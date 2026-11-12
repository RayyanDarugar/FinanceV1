export interface Usage {
  inputTokens: number;
  outputTokens: number;
  searches: number;
  fetches: number;
}

export const newUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0, searches: 0, fetches: 0 });

/** $ per million tokens (input, output). Anthropic first-party rates. */
const RATES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

export function estimateCostUsd(u: Usage, model: string = llmModel()): number {
  const [i, o] = RATES[model] ?? RATES["claude-opus-5-5"];
  return (u.inputTokens * i + u.outputTokens * o) / 1_000_000;
}

export function addUsage(into: Usage, from: Partial<Usage>) {
  into.inputTokens += from.inputTokens ?? 0;
  into.outputTokens += from.outputTokens ?? 0;
  into.searches += from.searches ?? 0;
  into.fetches += from.fetches ?? 0;
}

export function llmModel(): string {
  return process.env.LLM_MODEL || "claude-opus-5-5";
}
