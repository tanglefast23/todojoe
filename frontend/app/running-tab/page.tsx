"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useOwnerStore } from "@/stores/ownerStore";
import { useRunningTabStore } from "@/stores/runningTabStore";
import { usePermissionsStore } from "@/stores/permissionsStore";
import { BalanceDisplay, formatVND } from "@/components/running-tab/BalanceDisplay";
import { InitializeBalanceForm } from "@/components/running-tab/InitializeBalanceForm";
import { AddExpenseModal } from "@/components/running-tab/AddExpenseModal";
import { ExpenseShortcuts } from "@/components/running-tab/ExpenseShortcuts";
import { ExpenseList } from "@/components/running-tab/ExpenseList";
import { TabHistory } from "@/components/running-tab/TabHistory";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function RunningTabPage() {
  // Redirect to login if not authenticated
  const { isLoading: isAuthLoading, isAuthenticated } = useAuthGuard();

  // Hydration-safe state
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Owner state
  const getActiveOwnerId = useOwnerStore((state) => state.getActiveOwnerId);
  const isMasterLoggedIn = useOwnerStore((state) => state.isMasterLoggedIn);
  const owners = useOwnerStore((state) => state.owners);

  // Running tab state
  const tab = useRunningTabStore((state) => state.tab);
  const expenses = useRunningTabStore((state) => state.expenses);
  const history = useRunningTabStore((state) => state.history);
  const initializeBalance = useRunningTabStore((state) => state.initializeBalance);
  const adjustBalance = useRunningTabStore((state) => state.adjustBalance);
  const addExpense = useRunningTabStore((state) => state.addExpense);
  const addBulkExpenses = useRunningTabStore((state) => state.addBulkExpenses);
  const addToBalance = useRunningTabStore((state) => state.addToBalance);
  const approveExpense = useRunningTabStore((state) => state.approveExpense);
  const approveAllPendingExpenses = useRunningTabStore((state) => state.approveAllPendingExpenses);
  const rejectAllPendingExpenses = useRunningTabStore((state) => state.rejectAllPendingExpenses);
  const rejectExpense = useRunningTabStore((state) => state.rejectExpense);
  const setAttachment = useRunningTabStore((state) => state.setAttachment);
  const clearCompletedExpenses = useRunningTabStore((state) => state.clearCompletedExpenses);

  // Balance adjustment modal state (admin only)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const adjustAmountRef = useRef<HTMLInputElement>(null);

  // Clear all modal state (admin only)
  const [clearAllModalOpen, setClearAllModalOpen] = useState(false);

  // Top-up confirmation dialog state
  const [topUpConfirmOpen, setTopUpConfirmOpen] = useState(false);

  // Prefilled expense name from shortcuts
  const [prefilledExpenseName, setPrefilledExpenseName] = useState("");

  // Permissions
  const canApproveExpenses = usePermissionsStore((state) => state.canApproveExpenses);

  // Derived state (hydration-safe)
  const activeOwnerId = isMounted ? getActiveOwnerId() : null;
  const isMaster = isMounted ? isMasterLoggedIn() : false;
  const isTabInitialized = isMounted && tab !== null;
  const userCanApprove = isMounted && activeOwnerId ? canApproveExpenses(activeOwnerId) : false;

  // Owner list for display (simplified)
  const ownerList = useMemo(() => {
    return owners.map((o) => ({ id: o.id, name: o.name }));
  }, [owners]);

  // Handlers
  const handleInitialize = (amount: number) => {
    initializeBalance(amount, activeOwnerId);
  };

  const handleAddExpense = (name: string, amount: number) => {
    addExpense(name, amount, activeOwnerId);
  };

  const handleAddBulkExpenses = (entries: { name: string; amount: number }[]) => {
    addBulkExpenses(entries, activeOwnerId);
  };

  const handleTopUp = (amount: number, description: string) => {
    addToBalance(amount, description, activeOwnerId);
  };

  const handleApprove = (id: string) => {
    approveExpense(id, activeOwnerId);
  };

  const handleApproveAll = () => {
    approveAllPendingExpenses(activeOwnerId);
  };

  const handleRejectAll = (reason: string) => {
    rejectAllPendingExpenses(reason, activeOwnerId);
  };

  const handleReject = (id: string, reason: string) => {
    rejectExpense(id, reason, activeOwnerId);
  };

  const handleAttachment = (expenseId: string, url: string) => {
    setAttachment(expenseId, url);
  };

  // Balance adjustment handlers
  const openAdjustModal = () => {
    if (tab) {
      setAdjustAmount(tab.currentBalance.toLocaleString("vi-VN"));
      setAdjustReason("");
      setAdjustModalOpen(true);
      setTimeout(() => adjustAmountRef.current?.focus(), 50);
    }
  };

  const handleAdjustAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    if (value) {
      const num = parseInt(value, 10);
      setAdjustAmount(num.toLocaleString("vi-VN"));
    } else {
      setAdjustAmount("");
    }
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseInt(adjustAmount.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(numAmount) && adjustReason.trim()) {
      adjustBalance(numAmount, adjustReason.trim(), activeOwnerId);
      setAdjustModalOpen(false);
      setAdjustAmount("");
      setAdjustReason("");
    }
  };

  // Show loading state while checking authentication
  if (isAuthLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Show loading state while hydrating
  if (!isMounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 px-4 py-4 sm:px-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Show Initialize Form if not initialized (master only) */}
          {!isTabInitialized && isMaster && (
            <InitializeBalanceForm onInitialize={handleInitialize} />
          )}

          {/* Show message if not initialized and not master */}
          {!isTabInitialized && !isMaster && (
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <CardTitle>Tab Not Initialized</CardTitle>
                <CardDescription>
                  The running tab has not been set up yet. Please ask a master
                  account holder to initialize the starting balance.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {/* Main Content - only show if initialized */}
          {isTabInitialized && (
            <>
              {/* Balance Display - double-tap to edit (master only) */}
              <BalanceDisplay
                amount={tab.currentBalance}
                canEdit={isMaster}
                onEdit={openAdjustModal}
              />

              {/* Expense Actions - Shortcuts + Buttons grouped together */}
              <section className="space-y-3">
                {/* Quick Expense Shortcuts */}
                <ExpenseShortcuts onSelectExpense={setPrefilledExpenseName} />

                {/* Action Buttons */}
                <div className="flex justify-center items-center gap-3">
                  <AddExpenseModal
                    onAddExpense={handleAddExpense}
                    onAddBulkExpenses={handleAddBulkExpenses}
                    prefilledName={prefilledExpenseName}
                    onClearPrefilled={() => setPrefilledExpenseName("")}
                  />
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 h-10"
                    onClick={() => setTopUpConfirmOpen(true)}
                  >
                    +5M
                  </Button>
                </div>
              </section>

              {/* Expense List - each section has its own card */}
              <ExpenseList
                expenses={expenses}
                owners={ownerList}
                canApprove={userCanApprove}
                onApprove={handleApprove}
                onApproveAll={userCanApprove ? handleApproveAll : undefined}
                onReject={handleReject}
                onRejectAll={userCanApprove ? handleRejectAll : undefined}
                onAttachment={handleAttachment}
              />

              {/* Tab History */}
              <TabHistory history={history} owners={ownerList} />

              {/* Clear All Button - Admin only, at the very bottom */}
              {isMaster && (expenses.filter(e => e.status !== "pending").length > 0) && (
                <div className="flex justify-center pt-8 pb-4">
                  <Button
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950 border-red-300 dark:border-red-800"
                    onClick={() => setClearAllModalOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Approved & Rejected
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Clear All Confirmation Modal (Admin Only) */}
      <Dialog open={clearAllModalOpen} onOpenChange={setClearAllModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clear Completed Expenses</DialogTitle>
            <DialogDescription>
              This will permanently delete all approved and rejected expenses. Pending expenses will be kept. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setClearAllModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                clearCompletedExpenses();
                setClearAllModalOpen(false);
              }}
            >
              Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Balance Adjustment Modal (Admin Only) */}
      <Dialog open={adjustModalOpen} onOpenChange={setAdjustModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Balance</DialogTitle>
            <DialogDescription>
              Manually change the current balance. Current: {tab ? formatVND(tab.currentBalance) : "0 ₫"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdjustSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">New Balance (VND)</label>
              <Input
                ref={adjustAmountRef}
                type="text"
                inputMode="numeric"
                value={adjustAmount}
                onChange={handleAdjustAmountChange}
                placeholder="Enter new balance"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Reason</label>
              <Input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g., Cash reload, Correction, etc."
                className="mt-1"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdjustModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!adjustAmount || !adjustReason.trim()}>
                Update Balance
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Top-Up Confirmation Dialog */}
      <Dialog open={topUpConfirmOpen} onOpenChange={setTopUpConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Top Up</DialogTitle>
            <DialogDescription>
              Are you sure you want to request a top up of 5,000,000 VND? This will need to be approved by a master account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTopUpConfirmOpen(false)}
            >
              No
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                addExpense("Kia Top Up", 5000000, activeOwnerId);
                setTopUpConfirmOpen(false);
              }}
            >
              Yes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
