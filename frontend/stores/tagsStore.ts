/**
 * Tags Zustand store with localStorage persistence
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Tag } from "@/types/dashboard";
import { TAG_COLORS } from "@/types/dashboard";

interface TagsState {
  tags: Tag[];

  // Actions
  addTag: (name: string, color?: string) => void;
  removeTag: (id: string) => void;
  updateTag: (id: string, updates: Partial<Omit<Tag, "id">>) => void;
  getTagById: (id: string) => Tag | undefined;
  getTagsByIds: (ids: string[]) => Tag[];
  // Setter for Supabase sync - completely replaces tags state
  setTags: (tags: Tag[]) => void;
}

// Generate proper UUID v4
function generateUUID(): string {
  return crypto.randomUUID();
}

function getNextColor(existingTags: Tag[]): string {
  const usedColors = new Set(existingTags.map((t) => t.color));
  const availableColor = TAG_COLORS.find((c) => !usedColors.has(c));
  return availableColor || TAG_COLORS[existingTags.length % TAG_COLORS.length];
}

// Fixed UUIDs for default tags (consistent across all devices)
const DEFAULT_TAG_STOCKS_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_TAG_CRYPTO_ID = "00000000-0000-0000-0000-000000000002";

const DEFAULT_TAGS: Tag[] = [
  { id: DEFAULT_TAG_STOCKS_ID, name: "Stocks", color: TAG_COLORS[0] },
  { id: DEFAULT_TAG_CRYPTO_ID, name: "Crypto", color: TAG_COLORS[1] },
];

// Check if a tag ID is a default tag
function isDefaultTag(id: string): boolean {
  return id === DEFAULT_TAG_STOCKS_ID || id === DEFAULT_TAG_CRYPTO_ID ||
         id === "tag-stocks" || id === "tag-crypto"; // backwards compat
}

export const useTagsStore = create<TagsState>()(
  persist(
    (set, get) => ({
      tags: DEFAULT_TAGS,

      addTag: (name, color) => {
        const id = generateUUID();
        const tagColor = color || getNextColor(get().tags);

        set((state) => ({
          tags: [...state.tags, { id, name, color: tagColor }],
        }));
      },

      removeTag: (id) => {
        // Don't remove default tags
        if (isDefaultTag(id)) {
          return;
        }

        set((state) => ({
          tags: state.tags.filter((t) => t.id !== id),
        }));
      },

      updateTag: (id, updates) => {
        set((state) => ({
          tags: state.tags.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
      },

      getTagById: (id) => {
        return get().tags.find((t) => t.id === id);
      },

      getTagsByIds: (ids) => {
        return get().tags.filter((t) => ids.includes(t.id));
      },

      setTags: (tags) => {
        set({ tags });
      },
    }),
    {
      name: "tags-storage",
      // Migrate old tag IDs to new UUID format on load
      onRehydrateStorage: () => (state) => {
        if (state) {
          const migratedTags = state.tags.map((tag) => {
            // Migrate old string IDs to new UUIDs
            if (tag.id === "tag-stocks") {
              return { ...tag, id: DEFAULT_TAG_STOCKS_ID };
            }
            if (tag.id === "tag-crypto") {
              return { ...tag, id: DEFAULT_TAG_CRYPTO_ID };
            }
            return tag;
          });

          // Only update if migration actually happened
          const needsMigration = state.tags.some(
            (t) => t.id === "tag-stocks" || t.id === "tag-crypto"
          );
          if (needsMigration) {
            console.log("[Tags] Migrating old tag IDs to UUIDs");
            state.setTags(migratedTags);
          }
        }
      },
    }
  )
);
