import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import type { FactKey } from "@/lib/brain/facts";
import { AI_MODEL, AI_REASONING_EFFORT, getOpenAI, isAiConfigured } from "./openai";
import { SYSTEM_INSTRUCTIONS, type BrainBlock } from "./prompt";

export type CompileErrorCode =
  | "ai_not_configured"
  | "ai_key_invalid"
  | "ai_quota"
  | "ai_rate_limited"
  | "ai_unreachable"
  | "ai_model_unavailable"
  | "ai_incomplete"
  | "ai_refused"
  | "ai_failed";

export type CompileError = { code: "missing_facts"; missing: FactKey[] } | { code: CompileErrorCode };

export type CompileUsage = { inputTokens: number; cachedTokens: number; outputTokens: number };

export type RunResult<T> =
  | { ok: true; output: T; usage: CompileUsage; model: string }
  | { ok: false; error: CompileError };

const fail = <T>(code: CompileErrorCode): RunResult<T> => ({ ok: false, error: { code } });

/**
 * One structured call to OpenAI, shared by every studio.
 * Prompt order is fixed for caching: instructions, then the brand's Company
 * Brain (stable until edited), then the task that changes per request.
 */
export async function runStructured<T>(args: {
  brandId: string;
  brain: BrainBlock;
  task: string;
  schema: z.ZodType;
  schemaName: string;
}): Promise<RunResult<T>> {
  if (!isAiConfigured()) return fail("ai_not_configured");

  try {
    const response = await getOpenAI().responses.parse({
      model: AI_MODEL,
      instructions: SYSTEM_INSTRUCTIONS,
      input: [
        { role: "user", content: args.brain.text },
        { role: "user", content: args.task },
      ],
      text: { format: zodTextFormat(args.schema, args.schemaName) },
      reasoning: { effort: AI_REASONING_EFFORT },
      prompt_cache_key: `brand:${args.brandId}`,
      max_output_tokens: 32_000,
      store: false,
    });

    if (response.status === "incomplete") return fail("ai_incomplete");

    const parsed = response.output_parsed as T | null;
    if (!parsed) {
      const refused = response.output.some(
        (item) => item.type === "message" && item.content.some((part) => part.type === "refusal"),
      );
      return fail(refused ? "ai_refused" : "ai_failed");
    }

    return {
      ok: true,
      output: parsed,
      model: response.model ?? AI_MODEL,
      usage: {
        inputTokens: response.usage?.input_tokens ?? 0,
        cachedTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
      },
    };
  } catch (error) {
    if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) {
      return fail("ai_key_invalid");
    }
    if (error instanceof OpenAI.RateLimitError) {
      return fail(error.code === "insufficient_quota" ? "ai_quota" : "ai_rate_limited");
    }
    if (error instanceof OpenAI.NotFoundError) return fail("ai_model_unavailable");
    if (error instanceof OpenAI.APIConnectionError) return fail("ai_unreachable");
    console.error(`[runStructured:${args.schemaName}] OpenAI call failed`, error);
    return fail("ai_failed");
  }
}
