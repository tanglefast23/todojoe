"use client";

import { useMemo } from "react";
import type { Expense, ExpenseWithOwner } from "@/types/runningTab";
import { ExpenseItem } from "./ExpenseItem";

interface ExpenseListProps {
  expenses: Expense[];
  owners: { id: string; name: string }[];
  canApprove: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onAttachment: (id: string, url: string) => void;
}

export function ExpenseList({
  expenses,
  owners,
  canApprove,
  onApprove,
  onReject,
  onAttachment,
}: ExpenseListProps) {
  // Group expenses by status
  const { pending, approved, rejected } = useMemo(() => {
    const ownerMap = new Map(owners.map((o) => [o.id, o.name]));

    const enrichExpense = (e: Expense): ExpenseWithOwner => ({
      ...e,
      creatorName: e.createdBy ? ownerMap.get(e.createdBy) : undefined,
      approverName: e.approvedBy ? ownerMap.get(e.approvedBy) : undefined,
    });

    return {
      pending: expenses
        .filter((e) => e.status === "pending")
        .map(enrichExpense)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      approved: expenses
        .filter((e) => e.status === "approved")
        .map(enrichExpense)
        .sort((a, b) => new Date(b.approvedAt || b.createdAt).getTime() - new Date(a.approvedAt || a.createdAt).getTime()),
      rejected: expenses
        .filter((e) => e.status === "rejected")
        .map(enrichExpense)
        .sort((a, b) => new Date(b.approvedAt || b.createdAt).getTime() - new Date(a.approvedAt || a.createdAt).getTime()),
    };
  }, [expenses, owners]);

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No expenses yet.</p>
        <p className="text-sm mt-1">Add your first expense to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Section */}
      {pending.length > 0 && (
        <ExpenseSection
          title="Pending Approval"
          count={pending.length}
          expenses={pending}
          canApprove={canApprove}
          onApprove={onApprove}
          onReject={onReject}
          onAttachment={onAttachment}
        />
      )}

      {/* Approved Section */}
      {approved.length > 0 && (
        <ExpenseSection
          title="Approved"
          count={approved.length}
          expenses={approved}
          canApprove={canApprove}
          onApprove={onApprove}
          onReject={onReject}
          onAttachment={onAttachment}
        />
      )}

      {/* Rejected Section */}
      {rejected.length > 0 && (
        <ExpenseSection
          title="Rejected"
          count={rejected.length}
          expenses={rejected}
          canApprove={canApprove}
          onApprove={onApprove}
          onReject={onReject}
          onAttachment={onAttachment}
        />
      )}
    </div>
  );
}

interface ExpenseSectionProps {
  title: string;
  count: number;
  expenses: ExpenseWithOwner[];
  canApprove: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onAttachment: (id: string, url: string) => void;
}

function ExpenseSection({
  title,
  count,
  expenses,
  canApprove,
  onApprove,
  onReject,
  onAttachment,
}: ExpenseSectionProps) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        {title} ({count})
      </h3>
      <div className="space-y-3">
        {expenses.map((expense) => (
          <ExpenseItem
            key={expense.id}
            expense={expense}
            creatorName={expense.creatorName}
            approverName={expense.approverName}
            canApprove={canApprove}
            onApprove={onApprove}
            onReject={onReject}
            onAttachment={onAttachment}
          />
        ))}
      </div>
    </div>
  );
}
