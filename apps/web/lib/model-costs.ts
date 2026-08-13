const prices: Record<string, { input: number; output: number }> = {
  "gpt-5.6-luna": { input: 1, output: 6 },
  "gpt-5.6-terra": { input: 2.5, output: 15 },
  "gpt-5.6-sol": { input: 5, output: 30 },
};

export function estimatedCost(model: string, usage?: { input_tokens?: number; output_tokens?: number } | null) {
  const price = prices[model];
  if (!price || !usage) return null;
  return ((usage.input_tokens ?? 0) * price.input + (usage.output_tokens ?? 0) * price.output) / 1_000_000;
}

export function formatCost(value: number | null) {
  return value === null ? "—" : `$${value.toFixed(4)}`;
}
