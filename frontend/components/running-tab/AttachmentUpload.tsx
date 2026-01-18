"use client";

import { useState, useRef } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadAttachment } from "@/lib/supabase/queries/storage";

interface AttachmentUploadProps {
  expenseId: string;
  onUpload: (url: string) => void;
}

/**
 * Attachment upload component.
 * Uploads files to Supabase Storage and returns the public URL.
 */
export function AttachmentUpload({ expenseId, onUpload }: AttachmentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      alert("Please upload an image (JPEG, PNG, GIF, WebP) or PDF file.");
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert("File size must be less than 5MB.");
      return;
    }

    setIsUploading(true);

    try {
      // Upload to Supabase Storage
      const publicUrl = await uploadAttachment(file, expenseId);
      onUpload(publicUrl);

      // Clear the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileChange}
        className="hidden"
      />
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={isUploading}
        title="Add photo or receipt"
        className="h-9 w-9 p-0 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-400/50 hover:border-pink-400 hover:from-pink-500/30 hover:to-purple-500/30 transition-all"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-pink-500" />
        ) : (
          <ImagePlus className="h-4 w-4 text-pink-500" />
        )}
        <span className="sr-only">Add attachment</span>
      </Button>
    </>
  );
}
