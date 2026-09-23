// A/B comparison done in code, so the verdict never depends on the AI's arithmetic.
import type { VariantMetrics } from "./schema";

export type Confidence = "strong" | "leaning" | "unclear" | "not_enough_data";

export type Comparison = {
  /** Which event was compared: results when there are enough, otherwise clicks. */
  metric: "conversions" | "clicks" | null;
  rateA: number | null;
  rateB: number | null;
  /** Relative difference of B over A, e.g. 0.25 = B is 25% higher. */
  lift: number | null;
  pValue: number | null;
  confidence: Confidence;
  winner: "a" | "b" | null;
};

const MIN_REACHED = 30;
const MIN_CONVERSIONS = 10;
const MIN_CLICKS = 20;

export function rate(events: number, reached: number) {
  return reached > 0 ? events / reached : null;
}

export function costPer(spend: number, events: number) {
  return events > 0 && spend > 0 ? spend / events : null;
}

// Abramowitz & Stegun 7.1.26 (max error ≈ 1.5e-7).
function erf(x: number) {
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return sign * y;
}

function normalCdf(z: number) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Two-sided two-proportion z-test. */
function twoProportionPValue(x1: number, n1: number, x2: number, n2: number) {
  const pooled = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (!Number.isFinite(se) || se === 0) return null;
  const z = (x1 / n1 - x2 / n2) / se;
  return 2 * (1 - normalCdf(Math.abs(z)));
}

/**
 * Rough people-per-variant needed to confirm a difference this size
 * (95% confidence, 80% power). Null when the rates are equal or unknown.
 */
export function sampleNeededPerVariant(rateA: number | null, rateB: number | null) {
  if (rateA === null || rateB === null || rateA === rateB) return null;
  const variance = rateA * (1 - rateA) + rateB * (1 - rateB);
  return Math.ceil(((1.96 + 0.84) ** 2 * variance) / (rateA - rateB) ** 2);
}

export function compareVariants(a: VariantMetrics, b: VariantMetrics): Comparison {
  const none: Comparison = {
    metric: null,
    rateA: null,
    rateB: null,
    lift: null,
    pValue: null,
    confidence: "not_enough_data",
    winner: null,
  };
  if (a.reached < MIN_REACHED || b.reached < MIN_REACHED) return none;

  const metric =
    a.conversions + b.conversions >= MIN_CONVERSIONS
      ? "conversions"
      : a.clicks + b.clicks >= MIN_CLICKS
        ? "clicks"
        : null;
  if (!metric) return none;

  const x1 = Math.min(a[metric], a.reached);
  const x2 = Math.min(b[metric], b.reached);
  const rateA = x1 / a.reached;
  const rateB = x2 / b.reached;
  const lift = rateA > 0 ? (rateB - rateA) / rateA : null;
  const pValue = twoProportionPValue(x1, a.reached, x2, b.reached);

  const confidence: Confidence =
    pValue === null ? "unclear" : pValue < 0.05 ? "strong" : pValue < 0.2 ? "leaning" : "unclear";
  const winner = confidence === "strong" || confidence === "leaning" ? (rateB > rateA ? "b" : "a") : null;

  return { metric, rateA, rateB, lift, pValue, confidence, winner };
}
