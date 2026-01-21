/**
 * Supabase Storage queries for attachments
 */
import { getSupabaseClient, isSupabaseConfigured } from "../client";

const BUCKET_NAME = "attachments";

/**
 * Upload a file to Supabase Storage
 * @param file The file to upload
 * @param expenseId The expense ID to use as path prefix
 * @returns The public URL of the uploaded file
 */
export async function uploadAttachment(file: File, expenseId: string): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase storage is not configured. Cannot upload attachments.");
  }
  const supabase = getSupabaseClient();

  // Create a unique filename with timestamp to avoid collisions
  const timestamp = Date.now();
  const extension = file.name.split(".").pop() || "file";
  const fileName = `${expenseId}/${timestamp}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Error uploading file:", error);
    throw error;
  }

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Delete an attachment from Supabase Storage
 * @param url The public URL of the file to delete
 */
export async function deleteAttachment(url: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();

  // Extract the file path from the URL
  // URL format: https://{project}.supabase.co/storage/v1/object/public/attachments/{path}
  const urlParts = url.split(`/storage/v1/object/public/${BUCKET_NAME}/`);
  if (urlParts.length !== 2) {
    console.warn("Invalid attachment URL format, skipping deletion:", url);
    return;
  }

  const filePath = urlParts[1];

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
}

/**
 * Delete multiple attachments from Supabase Storage
 * @param urls Array of public URLs to delete
 */
export async function deleteAttachments(urls: string[]): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();

  // Extract file paths from URLs
  const filePaths: string[] = [];
  for (const url of urls) {
    if (!url) continue;

    const urlParts = url.split(`/storage/v1/object/public/${BUCKET_NAME}/`);
    if (urlParts.length === 2) {
      filePaths.push(urlParts[1]);
    }
  }

  if (filePaths.length === 0) return;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove(filePaths);

  if (error) {
    console.error("Error deleting files:", error);
    throw error;
  }
}
