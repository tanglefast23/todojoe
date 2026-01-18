/**
 * Hook for managing Asset Detail Modal state
 * Reusable across Portfolio and Quick Overview pages
 */

import { useState, useCallback } from "react";
import type { AssetType } from "@/types/portfolio";

interface AssetDetailModalState {
  open: boolean;
  symbol: string | null;
  assetType: AssetType | null;
  currentPrice: number;
  assetName?: string;
}

interface UseAssetDetailModalReturn extends AssetDetailModalState {
  openModal: (
    symbol: string,
    assetType: AssetType,
    currentPrice: number,
    assetName?: string
  ) => void;
  closeModal: () => void;
  setOpen: (open: boolean) => void;
}

const initialState: AssetDetailModalState = {
  open: false,
  symbol: null,
  assetType: null,
  currentPrice: 0,
  assetName: undefined,
};

export function useAssetDetailModal(): UseAssetDetailModalReturn {
  const [state, setState] = useState<AssetDetailModalState>(initialState);

  const openModal = useCallback(
    (
      symbol: string,
      assetType: AssetType,
      currentPrice: number,
      assetName?: string
    ) => {
      setState({
        open: true,
        symbol,
        assetType,
        currentPrice,
        assetName,
      });
    },
    []
  );

  const closeModal = useCallback(() => {
    setState(initialState);
  }, []);

  const setOpen = useCallback((open: boolean) => {
    if (!open) {
      setState(initialState);
    }
  }, []);

  return {
    ...state,
    openModal,
    closeModal,
    setOpen,
  };
}
