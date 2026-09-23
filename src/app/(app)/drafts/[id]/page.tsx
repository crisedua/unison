import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getReadyContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import type { DraftRow } from "@/lib/types";
import { DraftEditor } from "./draft-editor";

async function loadDraft(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("unison_drafts")
    .select("id, generation_id, asset_type, title, body, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  return data as DraftRow | null;
}

export async function generateMetadata({ params }: PageProps<"/drafts/[id]">): Promise<Metadata> {
  const draft = await loadDraft((await params).id);
  return { title: draft?.title };
}

export default async function DraftPage({ params }: PageProps<"/drafts/[id]">) {
  const ctx = await getReadyContext();
  if (!ctx) return null;

  const draft = await loadDraft((await params).id);
  if (!draft) notFound();

  return <DraftEditor key={draft.id} draft={draft} />;
}
