import "server-only";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
/** Longest text kept per document. */
export const MAX_DOCUMENT_CHARS = 100_000;

export type ExtractError = "unsupported" | "no_text" | "failed";

export type ExtractResult =
  | { ok: true; text: string; truncated: boolean }
  | { ok: false; error: ExtractError };

function extension(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

function finish(raw: string): ExtractResult {
  const text = raw.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 20) return { ok: false, error: "no_text" };
  return {
    ok: true,
    text: text.slice(0, MAX_DOCUMENT_CHARS),
    truncated: text.length > MAX_DOCUMENT_CHARS,
  };
}

/** Pulls plain text out of a PDF, Word (.docx), Markdown or text file. */
export async function extractDocumentText(file: File): Promise<ExtractResult> {
  const ext = extension(file.name);
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());

    if (ext === "pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes);
      const { text } = await extractText(pdf, { mergePages: true });
      return finish(text);
    }

    if (ext === "docx") {
      const mammoth = (await import("mammoth")).default;
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return finish(value);
    }

    if (ext === "txt" || ext === "md" || ext === "markdown") {
      return finish(new TextDecoder("utf-8").decode(bytes));
    }

    return { ok: false, error: "unsupported" };
  } catch (error) {
    console.error("[extractDocumentText] failed", error);
    return { ok: false, error: "failed" };
  }
}
