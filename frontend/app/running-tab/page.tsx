"use client";

import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useOwnerStore } from "@/stores/ownerStore";
import { useRunningTabStore } from "@/stores/runningTabStore";
import { usePermissionsStore } from "@/stores/permissionsStore";
import { BalanceDisplay } from "@/components/running-tab/BalanceDisplay";
import { InitializeBalanceForm } from "@/components/running-tab/InitializeBalanceForm";
import { AddExpenseModal } from "@/components/running-tab/AddExpenseModal";
import { ExpenseList } from "@/components/running-tab/ExpenseList";
import { TabHistory } from "@/components/running-tab/TabHistory";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  const addExpense = useRunningTabStore((state) => state.addExpense);
  const addBulkExpenses = useRunningTabStore((state) => state.addBulkExpenses);
  const approveExpense = useRunningTabStore((state) => state.approveExpense);
  const rejectExpense = useRunningTabStore((state) => state.rejectExpense);
  const setAttachment = useRunningTabStore((state) => state.setAttachment);

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

  const handleApprove = (id: string) => {
    approveExpense(id, activeOwnerId);
  };

  const handleReject = (id: string) => {
    rejectExpense(id, activeOwnerId);
  };

  const handleAttachment = (expenseId: string, url: string) => {
    setAttachment(expenseId, url);
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

      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Page Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">Running Tab</h1>
            <p className="text-muted-foreground mt-2">
              Track household expenses and manage your shared balance
            </p>
          </div>

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
              {/* Balance Display */}
              <Card>
                <CardContent className="pt-6">
                  <BalanceDisplay amount={tab.currentBalance} />
                </CardContent>
              </Card>

              {/* Add Expense Button */}
              <div className="flex justify-center">
                <AddExpenseModal
                  onAddExpense={handleAddExpense}
                  onAddBulkExpenses={handleAddBulkExpenses}
                />
              </div>

              {/* Expense List */}
              <Card>
                <CardHeader>
                  <CardTitle>Expenses</CardTitle>
                  <CardDescription>
                    {userCanApprove
                      ? "Review and approve/reject expenses"
                      : "Your expenses and their approval status"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ExpenseList
                    expenses={expenses}
                    owners={ownerList}
                    canApprove={userCanApprove}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onAttachment={handleAttachment}
                  />
                </CardContent>
              </Card>

              {/* Tab History */}
              <TabHistory history={history} owners={ownerList} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
