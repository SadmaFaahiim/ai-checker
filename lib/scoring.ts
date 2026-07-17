export type Verdict = "Likely Human" | "Uncertain" | "Likely AI-generated";

/** Buckets a 0-100 AI-likelihood percentage into a human-readable verdict. */
export function toVerdict(percentage: number): Verdict {
  if (percentage < 35) return "Likely Human";
  if (percentage <= 65) return "Uncertain";
  return "Likely AI-generated";
}

export interface CheckResult {
  percentage: number;
  verdict: Verdict;
  provider: string;
}

export interface VideoCheckResult extends CheckResult {
  perFrame: number[];
}
