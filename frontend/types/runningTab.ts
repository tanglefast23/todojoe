export interface RunningTab {
  id: string;
  initialBalance: number;
  currentBalance: number;
  initializedBy: string | null;
  initializedAt: string | null;
  updatedAt: string;
}

export type ExpenseStatus = 'pending' | 'approved' | 'rejected';

export interface Expense {
  id: string;
  name: string;
  amount: number;
  createdBy: string | null;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  status: ExpenseStatus;
  attachmentUrl: string | null;
  updatedAt: string;
}

export interface ExpenseWithOwner extends Expense {
  creatorName?: string;
  approverName?: string;
}

export type TabHistoryType = 'initial' | 'add' | 'expense_approved' | 'expense_rejected';

export interface TabHistoryEntry {
  id: string;
  type: TabHistoryType;
  amount: number;
  description: string | null;
  relatedExpenseId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface TabHistoryEntryWithOwner extends TabHistoryEntry {
  creatorName?: string;
}

export interface AppPermissions {
  id: string;
  ownerId: string;
  canCompleteTasks: boolean;
  canApproveExpenses: boolean;
  updatedAt: string;
}
