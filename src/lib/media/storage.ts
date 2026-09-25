import "server-only";
import type { Supabase } from "@/lib/brain/queries";

// Generated images live in one private Supabase Storage bucket, under
// <workspace>/<generation>/..., and are shown through short-lived signed URLs.
export const MEDIA_BUCKET = "unison-media";
const SIGNED_URL_SECONDS = 60 * 60;

/** Where a set's Reel images are stored. */
export function reelFolder(workspaceId: string, generationId: string) {
  return `${workspaceId}/${generationId}/reel`;
}

let bucketReady = false;

/** Creates the private bucket on first use (the server's secret key may do this). */
async function ensureBucket(supabase: Supabase) {
  if (bucketReady) return;
  const { data } = await supabase.storage.getBucket(MEDIA_BUCKET);
  if (!data) {
    const { error } = await supabase.storage.createBucket(MEDIA_BUCKET, { public: false });
    if (error && !/already exists/i.test(error.message)) throw new Error(`Could not create storage: ${error.message}`);
  }
  bucketReady = true;
}

export async function uploadMedia(supabase: Supabase, path: string, bytes: Buffer, contentType: string) {
  await ensureBucket(supabase);
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Could not save image: ${error.message}`);
}

/** File names directly under `folder`, sorted. Empty when the folder or bucket doesn't exist yet. */
export async function listMedia(supabase: Supabase, folder: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).list(folder, { limit: 100 });
  if (error) return [];
  return (data ?? [])
    .filter((item) => item.id) // folders have no id
    .map((item) => item.name)
    .sort();
}

export type SignedMedia = { name: string; url: string; downloadUrl: string };

export async function signMedia(supabase: Supabase, folder: string, names: string[], downloadPrefix: string) {
  const bucket = supabase.storage.from(MEDIA_BUCKET);
  return Promise.all(
    names.map(async (name): Promise<SignedMedia | null> => {
      const path = `${folder}/${name}`;
      const [view, download] = await Promise.all([
        bucket.createSignedUrl(path, SIGNED_URL_SECONDS),
        bucket.createSignedUrl(path, SIGNED_URL_SECONDS, { download: `${downloadPrefix}-${name}` }),
      ]);
      if (!view.data || !download.data) return null;
      return { name, url: view.data.signedUrl, downloadUrl: download.data.signedUrl };
    }),
  ).then((list) => list.filter((item): item is SignedMedia => item !== null));
}

export async function removeMedia(supabase: Supabase, folder: string, names: string[]) {
  if (names.length === 0) return;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(names.map((name) => `${folder}/${name}`));
  if (error) console.error("[removeMedia]", error.message);
}

/** Removes every file under `folder` (one level deep). Missing folders are fine. */
export async function removeMediaFolder(supabase: Supabase, folder: string) {
  await removeMedia(supabase, folder, await listMedia(supabase, folder));
}
