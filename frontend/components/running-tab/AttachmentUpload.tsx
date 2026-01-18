"use client";

import { useState, useRef } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AttachmentUploadProps {
  expenseId: string;
  onUpload: (url: string) => void;
}

/**
 * Attachment upload component.
 *
 * For now, this is a placeholder that simulates upload.
 * In production, this should:
 * 1. Upload to Supabase Storage using expenseId as path prefix
 * 2. Get back the public URL
 * 3. Call onUpload with the URL
 */
export function AttachmentUpload({ expenseId, onUpload }: AttachmentUploadProps) {
  // expenseId will be used as the storage path prefix when Supabase integration is added
  void expenseId;
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
      // TODO: Replace with actual Supabase Storage upload
      // For now, create a local object URL as placeholder
      const localUrl = URL.createObjectURL(file);

      // Simulate upload delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // In production, this would be the Supabase public URL
      onUpload(localUrl);

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
        size="icon-sm"
        onClick={handleClick}
        disabled={isUploading}
        title="Add attachment"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
        <span className="sr-only">Add attachment</span>
      </Button>
    </>
  );
}
