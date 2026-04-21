// File upload helpers for order / review proofs and avatars.
// - Client-side validation (type + size) BEFORE hitting the network.
// - Server-side policy enforces the user folder path via RLS, so even if the
//   client forges a path, the upload fails.

import { supabase } from "./supabase";

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export type BucketName =
  | "order-proofs"
  | "review-proofs"
  | "brand-logos"
  | "campaign-covers"
  | "avatars";

export interface UploadResult {
  path: string;         // bucket-relative path
  publicUrl: string;    // usable for public buckets; for private buckets you must sign on demand
  bucket: BucketName;
}

function safeExtension(file: File): string {
  const byMime: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  };
  return byMime[file.type] ?? "bin";
}

function randomId() {
  // crypto.randomUUID is fine in all modern browsers
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Upload a proof file into `bucket` under the caller's user folder.
 * Returns a path and a public URL (safe to store for public buckets;
 * ignore for private buckets and sign on demand instead).
 */
export async function uploadProof(
  bucket: BucketName,
  file: File,
  userId: string,
): Promise<UploadResult> {
  if (!ALLOWED_MIME.includes(file.type as typeof ALLOWED_MIME[number])) {
    throw new Error("Only JPEG, PNG, or WEBP images are allowed");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File is larger than 5 MB");
  }
  if (!userId) throw new Error("Not signed in");

  const ext = safeExtension(file);
  const path = `${userId}/${Date.now()}-${randomId()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl, bucket };
}

export async function removeUpload(bucket: BucketName, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(error.message);
}
