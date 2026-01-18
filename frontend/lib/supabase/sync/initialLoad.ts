/**
 * Initial load from Supabase with robust sync strategy
 *
 * RULES:
 * 1. Cloud (Supabase) is the source of truth
 * 2. NEVER overwrite local with empty cloud data
 * 3. NEVER overwrite cloud with empty local data
 * 4. If cloud is empty but local has data, push local to cloud (recovery)
 * 5. If cloud has data, always use cloud data
 */

import { useOwnerStore } from "@/stores/ownerStore";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useTagsStore } from "@/stores/tagsStore";
import { fetchOwners, syncOwners } from "@/lib/supabase/queries/owners";
import {
  fetchPortfolios,
  syncPortfolios,
  syncAccounts,
} from "@/lib/supabase/queries/portfolios";
import { fetchAllTransactions, syncTransactions } from "@/lib/supabase/queries/transactions";
import { fetchTags, syncTags } from "@/lib/supabase/queries/tags";
import {
  fetchSymbolNotes,
  syncSymbolNotes,
  convertNotesToArray,
  convertNotesToRecord,
} from "@/lib/supabase/queries/symbolNotes";
import {
  fetchSymbolTags,
  syncSymbolTags,
  convertTagsToArray,
  convertTagsToRecord,
} from "@/lib/supabase/queries/symbolTags";
import {
  fetchTagGroupings,
  syncTagGroupings,
  convertGroupingsToArray,
  convertGroupingsToRecord,
} from "@/lib/supabase/queries/tagGroupings";
import {
  fetchTrackedSymbols,
  syncTrackedSymbols,
  convertTrackedToArray,
  convertTrackedToRecord,
} from "@/lib/supabase/queries/trackedSymbols";
import {
  fetchCostBasisOverrides,
  syncCostBasisOverrides,
  convertOverridesToArray,
  convertOverridesToRecord,
} from "@/lib/supabase/queries/costBasisOverrides";
import {
  fetchSellPlanProgress,
  syncSellPlanProgress,
  convertProgressToArrays,
  convertProgressToSets,
} from "@/lib/supabase/queries/sellPlanProgress";
import {
  fetchAllocationSnapshots,
  syncAllocationSnapshots,
  convertSnapshotsToArray,
  convertSnapshotsToLocal,
} from "@/lib/supabase/queries/allocationSnapshots";
import { useAllocationHistoryStore } from "@/stores/allocationHistoryStore";
import { useSellPlanStore } from "@/stores/sellPlanStore";
import { syncLogger as log } from "@/lib/logger";
import type { Owner } from "@/types/owner";
import type { Portfolio, Transaction } from "@/types/portfolio";
import type { Tag } from "@/types/dashboard";

interface InitialLoadDeps {
  setOwners: (owners: Owner[]) => void;
  setPortfolios: (portfolios: Portfolio[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setTags: (tags: Tag[]) => void;
  setSymbolNotes: (notes: Record<string, string>) => void;
  setSymbolTags: (tags: Record<string, string[]>) => void;
  setTagGroupings: (groupings: Record<string, Array<{ id: string; tags: string[] }>>) => void;
  setTrackedSymbols: (trackedSymbols: Record<string, string[]>) => void;
  setCostBasisOverrides: (overrides: Record<string, number>) => void;
}

/**
 * Perform initial data load from Supabase
 * Implements cloud-as-source-of-truth with recovery for empty cloud
 */
export async function performInitialLoad(deps: InitialLoadDeps): Promise<void> {
  const { setOwners, setPortfolios, setTransactions, setTags, setSymbolNotes, setSymbolTags, setTagGroupings, setTrackedSymbols, setCostBasisOverrides } = deps;

  log.info(" Loading data from Supabase (cloud is source of truth)...");

  // Get local data FIRST (before any cloud operations)
  const localOwners = useOwnerStore.getState().owners;
  const localPortfolios = usePortfolioStore.getState().portfolios;
  const localTransactions = usePortfolioStore.getState().transactions;
  const localTags = useTagsStore.getState().tags;

  console.log(
    `[Sync] Local state: ${localOwners.length} owners, ${localPortfolios.length} portfolios, ${localTransactions.length} transactions, ${localTags.length} tags`
  );

  // Fetch from cloud in PARALLEL for better performance (was sequential waterfall)
  // All these are independent queries that can run concurrently
  const [dbOwners, dbPortfolios, dbTagsResult, dbTransactionsResult] = await Promise.all([
    fetchOwners(),
    fetchPortfolios(),
    fetchTags().catch((tagError) => {
      log.warn(" Tags fetch failed (non-critical):", tagError);
      return [] as Awaited<ReturnType<typeof fetchTags>>;
    }),
    fetchAllTransactions(),
  ]);

  let dbTags = dbTagsResult;
  let dbTransactions = dbTransactionsResult;
  if (dbTransactions.length === 0 && localTransactions.length > 0) {
    console.warn(
      "[Sync] Cloud returned 0 transactions but local has data. Retrying fetch..."
    );
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
    dbTransactions = await fetchAllTransactions();
    if (dbTransactions.length === 0) {
      console.warn(
        "[Sync] Retry still returned 0. Cloud may be empty or having issues."
      );
    }
  }

  console.log(
    `[Sync] Cloud state: ${dbOwners.length} owners, ${dbPortfolios.length} portfolios, ${dbTransactions.length} transactions, ${dbTags.length} tags`
  );

  // SYNC DECISION LOGIC
  // For each data type: if cloud has data, use cloud. If cloud empty but local has data, push local.

  // === OWNERS ===
  await syncOwnersData(dbOwners, localOwners, setOwners);

  // === PORTFOLIOS ===
  await syncPortfoliosData(dbPortfolios, localPortfolios, setPortfolios);

  // === TRANSACTIONS (MOST CRITICAL) ===
  await syncTransactionsData(dbTransactions, localTransactions, setTransactions);

  // === TAGS ===
  await syncTagsData(dbTags, localTags, setTags);

  // === SYMBOL NOTES (non-critical) ===
  await syncSymbolNotesData(setSymbolNotes);

  // === SYMBOL TAGS (non-critical) ===
  await syncSymbolTagsData(setSymbolTags);

  // === TAG GROUPINGS (non-critical) ===
  await syncTagGroupingsData(setTagGroupings);

  // === TRACKED SYMBOLS (non-critical) ===
  await syncTrackedSymbolsData(setTrackedSymbols);

  // === COST BASIS OVERRIDES (non-critical) ===
  await syncCostBasisOverridesData(setCostBasisOverrides);

  // === ALLOCATION SNAPSHOTS (non-critical) ===
  await syncAllocationSnapshotsData();

  log.info(" ✓ Initial load complete");
}

async function syncOwnersData(
  dbOwners: Awaited<ReturnType<typeof fetchOwners>>,
  localOwners: Owner[],
  setOwners: (owners: Owner[]) => void
): Promise<void> {
  if (dbOwners.length > 0) {
    // Cloud has data - use it (source of truth)
    const mappedOwners: Owner[] = dbOwners.map((o) => ({
      id: o.id,
      name: o.name,
      passwordHash: o.password_hash,
      isMaster: o.is_master,
      createdAt: o.created_at,
    }));
    setOwners(mappedOwners);
    console.log(`[Sync] ✓ Loaded ${dbOwners.length} owners from cloud`);
  } else if (localOwners.length > 0) {
    // Cloud empty, local has data - push to cloud (recovery)
    console.log(`[Sync] Cloud empty, pushing ${localOwners.length} owners to cloud...`);
    await syncOwners(
      localOwners.map((o) => ({
        id: o.id,
        name: o.name,
        password_hash: o.passwordHash,
        is_master: o.isMaster || false,
        created_at: o.createdAt,
      }))
    );
    console.log(`[Sync] ✓ Pushed ${localOwners.length} owners to cloud, keeping local`);
  }
}

async function syncPortfoliosData(
  dbPortfolios: Awaited<ReturnType<typeof fetchPortfolios>>,
  localPortfolios: Portfolio[],
  setPortfolios: (portfolios: Portfolio[]) => void
): Promise<void> {
  if (dbPortfolios.length > 0) {
    // Cloud has data - use it
    const mappedPortfolios: Portfolio[] = dbPortfolios.map((p) => ({
      id: p.id,
      name: p.name,
      createdAt: p.created_at,
      isIncludedInCombined: p.is_included_in_combined,
      ownerIds: p.owner_ids || [],
      accounts: (p.accounts || []).map((a) => ({
        id: a.id,
        name: a.name,
        portfolioId: a.portfolio_id,
        createdAt: a.created_at,
      })),
    }));
    setPortfolios(mappedPortfolios);
    console.log(`[Sync] ✓ Loaded ${dbPortfolios.length} portfolios from cloud`);
  } else if (localPortfolios.length > 0) {
    // Cloud empty, local has data - push to cloud
    console.log(
      `[Sync] Cloud empty, pushing ${localPortfolios.length} portfolios to cloud...`
    );
    await syncPortfolios(
      localPortfolios.map((p) => ({
        id: p.id,
        name: p.name,
        owner_ids: p.ownerIds || [],
        is_included_in_combined: p.isIncludedInCombined,
        created_at: p.createdAt,
      }))
    );
    // Also push accounts
    const allAccounts: Array<{
      id: string;
      portfolio_id: string;
      name: string;
      created_at: string;
    }> = [];
    for (const portfolio of localPortfolios) {
      for (const account of portfolio.accounts) {
        allAccounts.push({
          id: account.id,
          portfolio_id: account.portfolioId,
          name: account.name,
          created_at: account.createdAt,
        });
      }
    }
    if (allAccounts.length > 0) {
      await syncAccounts(allAccounts);
    }
    console.log(
      `[Sync] ✓ Pushed ${localPortfolios.length} portfolios to cloud, keeping local`
    );
  }
}

async function syncTransactionsData(
  dbTransactions: Awaited<ReturnType<typeof fetchAllTransactions>>,
  localTransactions: Transaction[],
  setTransactions: (transactions: Transaction[]) => void
): Promise<void> {
  if (dbTransactions.length > 0) {
    // Cloud has data - use it (source of truth)
    const mappedTransactions: Transaction[] = dbTransactions.map((t) => ({
      id: t.id,
      portfolioId: t.portfolio_id,
      accountId: t.account_id,
      symbol: t.symbol,
      type: t.type,
      assetType: t.asset_type,
      quantity: t.quantity,
      price: t.price,
      date: t.date,
      notes: t.notes || undefined,
      tags: t.tags || undefined,
    }));
    setTransactions(mappedTransactions);
    console.log(`[Sync] ✓ Loaded ${dbTransactions.length} transactions from cloud`);
  } else if (localTransactions.length > 0) {
    // CRITICAL SAFEGUARD: Cloud is empty but local has data
    // This is the recovery scenario - push local to cloud
    console.log(
      `[Sync] ⚠️ Cloud has 0 transactions but local has ${localTransactions.length}. Pushing to cloud...`
    );
    await syncTransactions(
      localTransactions.map((t) => ({
        id: t.id,
        portfolio_id: t.portfolioId,
        account_id: t.accountId,
        symbol: t.symbol,
        type: t.type,
        asset_type: t.assetType,
        quantity: t.quantity,
        price: t.price,
        date: t.date,
        notes: t.notes || null,
        tags: t.tags || null,
      }))
    );
    console.log(
      `[Sync] ✓ Pushed ${localTransactions.length} transactions to cloud, keeping local`
    );
    // DON'T overwrite local - keep the data we just pushed
  } else {
    // Both empty - this is fine for a fresh start
    log.info(" ℹ️ No transactions in cloud or local (fresh start)");
  }
}

async function syncTagsData(
  dbTags: Awaited<ReturnType<typeof fetchTags>>,
  localTags: Tag[],
  setTags: (tags: Tag[]) => void
): Promise<void> {
  try {
    const isValidUUID = (id: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (dbTags.length > 0) {
      const mappedTags: Tag[] = dbTags.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
      }));
      setTags(mappedTags);
      console.log(`[Sync] ✓ Loaded ${dbTags.length} tags from cloud`);
    } else if (localTags.length > 0) {
      const syncableTags = localTags.filter((t) => isValidUUID(t.id));
      if (syncableTags.length > 0) {
        console.log(`[Sync] Cloud empty, pushing ${syncableTags.length} tags to cloud...`);
        await syncTags(
          syncableTags.map((t) => ({
            id: t.id,
            name: t.name,
            color: t.color,
            is_default: false,
          }))
        );
        console.log(`[Sync] ✓ Pushed tags to cloud, keeping local`);
      }
    }
  } catch (tagError) {
    log.warn(" Tags sync failed (non-critical):", tagError);
  }
}

async function syncSymbolNotesData(
  setSymbolNotes: (notes: Record<string, string>) => void
): Promise<void> {
  try {
    const localSymbolNotes = usePortfolioStore.getState().symbolNotes;
    const dbSymbolNotes = await fetchSymbolNotes();

    if (dbSymbolNotes.length > 0) {
      const mappedNotes = convertNotesToRecord(dbSymbolNotes);
      setSymbolNotes(mappedNotes);
      console.log(`[Sync] ✓ Loaded ${dbSymbolNotes.length} symbol notes from cloud`);
    } else if (Object.keys(localSymbolNotes).length > 0) {
      const notesArray = convertNotesToArray(localSymbolNotes);
      if (notesArray.length > 0) {
        console.log(
          `[Sync] Cloud empty, pushing ${notesArray.length} symbol notes to cloud...`
        );
        await syncSymbolNotes(notesArray);
        console.log(`[Sync] ✓ Pushed symbol notes to cloud, keeping local`);
      }
    }
  } catch (notesError) {
    log.warn(" Symbol notes sync failed (non-critical):", notesError);
  }
}

async function syncSymbolTagsData(
  setSymbolTags: (tags: Record<string, string[]>) => void
): Promise<void> {
  try {
    const localSymbolTags = usePortfolioStore.getState().symbolTags;
    const localCount = Object.keys(localSymbolTags).length;
    console.log(`[Sync] Symbol tags - local has ${localCount} entries, fetching from cloud...`);

    const dbSymbolTags = await fetchSymbolTags();
    console.log(`[Sync] Symbol tags - cloud has ${dbSymbolTags.length} entries`);

    if (dbSymbolTags.length > 0) {
      const mappedTags = convertTagsToRecord(dbSymbolTags);
      console.log(`[Sync] Symbol tags - mapped to ${Object.keys(mappedTags).length} local entries`);
      setSymbolTags(mappedTags);
      console.log(`[Sync] ✓ Loaded ${dbSymbolTags.length} symbol tags from cloud`);
    } else if (localCount > 0) {
      const tagsArray = convertTagsToArray(localSymbolTags);
      console.log(`[Sync] Symbol tags - converted ${localCount} local entries to ${tagsArray.length} sync items`);
      if (tagsArray.length > 0) {
        console.log(
          `[Sync] Cloud empty, pushing ${tagsArray.length} symbol tags to cloud...`
        );
        await syncSymbolTags(tagsArray);
        console.log(`[Sync] ✓ Pushed symbol tags to cloud, keeping local`);
      } else {
        console.log(`[Sync] ⚠️ Local tags exist but convertTagsToArray returned 0 items - check key format`);
        console.log(`[Sync] Local keys sample:`, Object.keys(localSymbolTags).slice(0, 5));
      }
    } else {
      console.log(`[Sync] ℹ️ No symbol tags in cloud or local`);
    }
  } catch (tagsError) {
    console.error("[Sync] ❌ Symbol tags sync failed:", tagsError);
    log.warn(" Symbol tags sync failed (non-critical):", tagsError);
  }
}

async function syncTagGroupingsData(
  setTagGroupings: (groupings: Record<string, Array<{ id: string; tags: string[] }>>) => void
): Promise<void> {
  console.log("[Sync] === Starting tag groupings sync ===");
  try {
    const localTagGroupings = usePortfolioStore.getState().tagGroupings;
    console.log(`[Sync] Tag groupings - local has ${Object.keys(localTagGroupings).length} portfolios`);

    const dbTagGroupings = await fetchTagGroupings();
    console.log(`[Sync] Tag groupings - cloud has ${dbTagGroupings.length} entries`);

    if (dbTagGroupings.length > 0) {
      const mappedGroupings = convertGroupingsToRecord(dbTagGroupings);
      setTagGroupings(mappedGroupings);
      console.log(`[Sync] ✓ Loaded ${dbTagGroupings.length} tag groupings from cloud`);
    } else if (Object.keys(localTagGroupings).length > 0) {
      const groupingsArray = convertGroupingsToArray(localTagGroupings);
      console.log(`[Sync] Tag groupings - converted to ${groupingsArray.length} items`);
      if (groupingsArray.length > 0) {
        console.log(
          `[Sync] Cloud empty, pushing ${groupingsArray.length} tag groupings to cloud...`
        );
        await syncTagGroupings(groupingsArray);
        console.log(`[Sync] ✓ Pushed tag groupings to cloud, keeping local`);
      }
    } else {
      console.log("[Sync] ℹ️ No tag groupings in cloud or local");
    }
  } catch (groupingsError) {
    console.error("[Sync] ❌ Tag groupings sync failed:", groupingsError);
  }
}

async function syncTrackedSymbolsData(
  setTrackedSymbols: (trackedSymbols: Record<string, string[]>) => void
): Promise<void> {
  try {
    const localTrackedSymbols = usePortfolioStore.getState().trackedSymbols;
    const dbTrackedSymbols = await fetchTrackedSymbols();

    if (dbTrackedSymbols.length > 0) {
      const mappedSymbols = convertTrackedToRecord(dbTrackedSymbols);
      setTrackedSymbols(mappedSymbols);
      console.log(`[Sync] ✓ Loaded ${dbTrackedSymbols.length} tracked symbols from cloud`);
    } else if (Object.keys(localTrackedSymbols).length > 0) {
      const symbolsArray = convertTrackedToArray(localTrackedSymbols);
      if (symbolsArray.length > 0) {
        console.log(
          `[Sync] Cloud empty, pushing ${symbolsArray.length} tracked symbols to cloud...`
        );
        await syncTrackedSymbols(symbolsArray);
        console.log(`[Sync] ✓ Pushed tracked symbols to cloud, keeping local`);
      }
    }
  } catch (error) {
    log.warn(" Tracked symbols sync failed (non-critical):", error);
  }
}

async function syncCostBasisOverridesData(
  setCostBasisOverrides: (overrides: Record<string, number>) => void
): Promise<void> {
  try {
    const localOverrides = usePortfolioStore.getState().costBasisOverrides;
    const dbOverrides = await fetchCostBasisOverrides();

    if (dbOverrides.length > 0) {
      const mappedOverrides = convertOverridesToRecord(dbOverrides);
      setCostBasisOverrides(mappedOverrides);
      console.log(`[Sync] ✓ Loaded ${dbOverrides.length} cost basis overrides from cloud`);
    } else if (Object.keys(localOverrides).length > 0) {
      const overridesArray = convertOverridesToArray(localOverrides);
      if (overridesArray.length > 0) {
        console.log(
          `[Sync] Cloud empty, pushing ${overridesArray.length} cost basis overrides to cloud...`
        );
        await syncCostBasisOverrides(overridesArray);
        console.log(`[Sync] ✓ Pushed cost basis overrides to cloud, keeping local`);
      }
    }
  } catch (error) {
    log.warn(" Cost basis overrides sync failed (non-critical):", error);
  }
}

async function syncAllocationSnapshotsData(): Promise<void> {
  try {
    const localSnapshots = useAllocationHistoryStore.getState().snapshots;
    const dbSnapshots = await fetchAllocationSnapshots();

    if (dbSnapshots.length > 0) {
      const mappedSnapshots = convertSnapshotsToLocal(dbSnapshots);
      useAllocationHistoryStore.getState().setSnapshots(mappedSnapshots);
      console.log(`[Sync] ✓ Loaded ${dbSnapshots.length} allocation snapshots from cloud`);
    } else if (localSnapshots.length > 0) {
      const snapshotsArray = convertSnapshotsToArray(localSnapshots);
      if (snapshotsArray.length > 0) {
        console.log(
          `[Sync] Cloud empty, pushing ${snapshotsArray.length} allocation snapshots to cloud...`
        );
        await syncAllocationSnapshots(snapshotsArray);
        console.log(`[Sync] ✓ Pushed allocation snapshots to cloud, keeping local`);
      }
    }
  } catch (error) {
    log.warn(" Allocation snapshots sync failed (non-critical):", error);
  }
}
