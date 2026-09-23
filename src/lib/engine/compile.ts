import "server-only";
import type { Brand, BrandDocument } from "@/lib/types";
import { contentSetSchema, type ContentSetInput, type ContentSetOutput } from "./assets";
import { buildBrainBlock, buildContentTask } from "./prompt";
import { runStructured, type RunResult } from "./run";

export type { CompileError, CompileErrorCode, CompileUsage } from "./run";

/** Writes a finished content set from the brand's Company Brain. Does not save anything. */
export async function compileContentSet(args: {
  brand: Brand;
  documents: BrandDocument[];
  source: BrandDocument | null;
  input: ContentSetInput;
}): Promise<RunResult<ContentSetOutput>> {
  const { brand, documents, source, input } = args;
  const brain = buildBrainBlock(brand, documents);
  const task = buildContentTask(input, source, source ? brain.includedDocumentIds.has(source.id) : false);

  return runStructured<ContentSetOutput>({
    brandId: brand.id,
    brain,
    task,
    schema: contentSetSchema(input.assets),
    schemaName: "content_set",
  });
}
