// The Company Brain: seven written fields plus notes & documents = 8 facts.
// Fact keys are also what the AI reports back in `facts_used`.

export const FACT_KEYS = [
  "company",
  "audience",
  "problem",
  "positioning",
  "offer",
  "proof",
  "voice",
  "notes",
] as const;

export type FactKey = (typeof FACT_KEYS)[number];

/** The text fields of a brand's brain, as stored on the `brands` row. */
export const BRAIN_FIELDS = [
  "company",
  "audience",
  "problem",
  "positioning",
  "offer",
  "proof",
  "voice_tone",
  "voice_use",
  "voice_avoid",
  "voice_example",
] as const;

export type BrainField = (typeof BRAIN_FIELDS)[number];
export type BrainValues = Record<BrainField, string>;

export const BRAIN_FIELD_MAX_LENGTH = 4000;

const filled = (value: string | undefined) => (value ?? "").trim().length >= 2;

/** Which facts are filled in. Voice counts once its tone is written. */
export function factStatus(values: BrainValues, documentCount: number): Record<FactKey, boolean> {
  return {
    company: filled(values.company),
    audience: filled(values.audience),
    problem: filled(values.problem),
    positioning: filled(values.positioning),
    offer: filled(values.offer),
    proof: filled(values.proof),
    voice: filled(values.voice_tone),
    notes: documentCount > 0,
  };
}

export function missingFacts(status: Record<FactKey, boolean>, required: readonly FactKey[]) {
  return required.filter((key) => !status[key]);
}
