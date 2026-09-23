import "server-only";
import OpenAI from "openai";
import { z } from "zod";

const effortSchema = z.enum(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);

/** The model that writes content. Change it in .env.local — no code change needed. */
export const AI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-6-sol";

export const AI_REASONING_EFFORT = effortSchema.catch("medium").parse(process.env.OPENAI_REASONING_EFFORT);

export function isAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

let client: OpenAI | null = null;

export function getOpenAI() {
  client ??= new OpenAI();
  return client;
}
