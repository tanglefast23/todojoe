/**
 * Supabase database types
 * Schema for shared data (no per-user auth)
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      owners: {
        Row: {
          id: string;
          name: string;
          password_hash: string;
          is_master: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          password_hash: string;
          is_master?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          password_hash?: string;
          is_master?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      // Separate owners table for TODO app (separate from investment tracker)
      todo_owners: {
        Row: {
          id: string;
          name: string;
          password_hash: string;
          is_master: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          password_hash: string;
          is_master?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          password_hash?: string;
          is_master?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      portfolios: {
        Row: {
          id: string;
          name: string;
          owner_ids: string[];
          is_included_in_combined: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_ids?: string[];
          is_included_in_combined?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_ids?: string[];
          is_included_in_combined?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      accounts: {
        Row: {
          id: string;
          portfolio_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          portfolio_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          portfolio_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          portfolio_id: string;
          account_id: string;
          symbol: string;
          type: "buy" | "sell";
          asset_type: "stock" | "crypto";
          quantity: number;
          price: number;
          date: string;
          notes: string | null;
          tags: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          portfolio_id: string;
          account_id: string;
          symbol: string;
          type: "buy" | "sell";
          asset_type: "stock" | "crypto";
          quantity: number;
          price: number;
          date: string;
          notes?: string | null;
          tags?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          portfolio_id?: string;
          account_id?: string;
          symbol?: string;
          type?: "buy" | "sell";
          asset_type?: "stock" | "crypto";
          quantity?: number;
          price?: number;
          date?: string;
          notes?: string | null;
          tags?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      tracked_symbols: {
        Row: {
          id: string;
          portfolio_id: string;
          symbol: string;
          asset_type: "stock" | "crypto";
          created_at: string;
        };
        Insert: {
          id?: string;
          portfolio_id: string;
          symbol: string;
          asset_type?: "stock" | "crypto";
          created_at?: string;
        };
        Update: {
          id?: string;
          portfolio_id?: string;
          symbol?: string;
          asset_type?: "stock" | "crypto";
          created_at?: string;
        };
      };
      app_settings: {
        Row: {
          id: string;
          auto_refresh_enabled: boolean;
          refresh_interval_seconds: number;
          metrics_mode: "simple" | "pro";
          currency: string;
          risk_free_rate: number;
          active_portfolio_id: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auto_refresh_enabled?: boolean;
          refresh_interval_seconds?: number;
          metrics_mode?: "simple" | "pro";
          currency?: string;
          risk_free_rate?: number;
          active_portfolio_id?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auto_refresh_enabled?: boolean;
          refresh_interval_seconds?: number;
          metrics_mode?: "simple" | "pro";
          currency?: string;
          risk_free_rate?: number;
          active_portfolio_id?: string | null;
          updated_at?: string;
        };
      };
      owner_dashboards: {
        Row: {
          id: string;
          owner_id: string;
          widgets: Json;
          layouts: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          widgets?: Json;
          layouts?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          widgets?: Json;
          layouts?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      owner_settings: {
        Row: {
          id: string;
          owner_id: string;
          auto_refresh_enabled: boolean;
          refresh_interval_seconds: number;
          metrics_mode: "simple" | "pro";
          currency: string;
          mobile_mode: "auto" | "mobile" | "desktop";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          auto_refresh_enabled?: boolean;
          refresh_interval_seconds?: number;
          metrics_mode?: "simple" | "pro";
          currency?: string;
          mobile_mode?: "auto" | "mobile" | "desktop";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          auto_refresh_enabled?: boolean;
          refresh_interval_seconds?: number;
          metrics_mode?: "simple" | "pro";
          currency?: string;
          mobile_mode?: "auto" | "mobile" | "desktop";
          created_at?: string;
          updated_at?: string;
        };
      };
      sell_plans: {
        Row: {
          id: string;
          owner_id: string;
          portfolio_id: string | null;
          symbol: string;
          asset_type: "stock" | "crypto";
          plan_type: "sell" | "buy";
          target_quantity: number | null;
          target_price: number | null;
          notes: string | null;
          status: "active" | "completed" | "cancelled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          portfolio_id?: string | null;
          symbol: string;
          asset_type: "stock" | "crypto";
          plan_type: "sell" | "buy";
          target_quantity?: number | null;
          target_price?: number | null;
          notes?: string | null;
          status?: "active" | "completed" | "cancelled";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          portfolio_id?: string | null;
          symbol?: string;
          asset_type?: "stock" | "crypto";
          plan_type?: "sell" | "buy";
          target_quantity?: number | null;
          target_price?: number | null;
          notes?: string | null;
          status?: "active" | "completed" | "cancelled";
          created_at?: string;
          updated_at?: string;
        };
      };
      tags: {
        Row: {
          id: string;
          name: string;
          color: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      symbol_notes: {
        Row: {
          id: string;
          portfolio_id: string;
          symbol: string;
          asset_type: "stock" | "crypto";
          note: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          portfolio_id: string;
          symbol: string;
          asset_type: "stock" | "crypto";
          note: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          portfolio_id?: string;
          symbol?: string;
          asset_type?: "stock" | "crypto";
          note?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      symbol_tags: {
        Row: {
          id: string;
          portfolio_id: string;
          symbol: string;
          asset_type: "stock" | "crypto";
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          portfolio_id: string;
          symbol: string;
          asset_type: "stock" | "crypto";
          tags: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          portfolio_id?: string;
          symbol?: string;
          asset_type?: "stock" | "crypto";
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      tag_groupings: {
        Row: {
          id: string;
          portfolio_id: string;
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          portfolio_id: string;
          tags: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          portfolio_id?: string;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      cost_basis_overrides: {
        Row: {
          id: string;
          portfolio_id: string;
          cost_basis: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          portfolio_id: string;
          cost_basis: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          portfolio_id?: string;
          cost_basis?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      sell_plan_progress: {
        Row: {
          id: string;
          owner_id: string;
          plan_id: string;
          account_id: string;
          progress_type: "sell" | "buy";
          buy_symbol: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          plan_id: string;
          account_id: string;
          progress_type: "sell" | "buy";
          buy_symbol?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          plan_id?: string;
          account_id?: string;
          progress_type?: "sell" | "buy";
          buy_symbol?: string | null;
          created_at?: string;
        };
      };
      allocation_snapshots: {
        Row: {
          id: string;
          portfolio_id: string | null;
          allocations: Record<string, number>;
          timestamp: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          portfolio_id?: string | null;
          allocations: Record<string, number>;
          timestamp: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          portfolio_id?: string | null;
          allocations?: Record<string, number>;
          timestamp?: number;
          created_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          priority: "regular" | "urgent";
          created_by: string | null;
          created_at: string;
          completed_by: string | null;
          completed_at: string | null;
          status: "pending" | "completed";
          attachment_url: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          priority?: "regular" | "urgent";
          created_by?: string | null;
          created_at?: string;
          completed_by?: string | null;
          completed_at?: string | null;
          status?: "pending" | "completed";
          attachment_url?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          priority?: "regular" | "urgent";
          created_by?: string | null;
          created_at?: string;
          completed_by?: string | null;
          completed_at?: string | null;
          status?: "pending" | "completed";
          attachment_url?: string | null;
          updated_at?: string;
        };
      };
      running_tab: {
        Row: {
          id: string;
          initial_balance: number;
          current_balance: number;
          initialized_by: string | null;
          initialized_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          initial_balance?: number;
          current_balance?: number;
          initialized_by?: string | null;
          initialized_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          initial_balance?: number;
          current_balance?: number;
          initialized_by?: string | null;
          initialized_at?: string | null;
          updated_at?: string;
        };
      };
      expenses: {
        Row: {
          id: string;
          name: string;
          amount: number;
          created_by: string | null;
          created_at: string;
          approved_by: string | null;
          approved_at: string | null;
          status: "pending" | "approved" | "rejected";
          attachment_url: string | null;
          rejection_reason: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          amount: number;
          created_by?: string | null;
          created_at?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          status?: "pending" | "approved" | "rejected";
          attachment_url?: string | null;
          rejection_reason?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          amount?: number;
          created_by?: string | null;
          created_at?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          status?: "pending" | "approved" | "rejected";
          attachment_url?: string | null;
          rejection_reason?: string | null;
          updated_at?: string;
        };
      };
      tab_history: {
        Row: {
          id: string;
          type: "initial" | "add" | "expense_approved" | "expense_rejected" | "adjustment";
          amount: number;
          description: string | null;
          related_expense_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: "initial" | "add" | "expense_approved" | "expense_rejected" | "adjustment";
          amount: number;
          description?: string | null;
          related_expense_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: "initial" | "add" | "expense_approved" | "expense_rejected" | "adjustment";
          amount?: number;
          description?: string | null;
          related_expense_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
      app_permissions: {
        Row: {
          id: string;
          owner_id: string;
          can_complete_tasks: boolean;
          can_approve_expenses: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          can_complete_tasks?: boolean;
          can_approve_expenses?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          can_complete_tasks?: boolean;
          can_approve_expenses?: boolean;
          updated_at?: string;
        };
      };
      scheduled_events: {
        Row: {
          id: string;
          title: string;
          scheduled_at: string;
          created_by: string | null;
          created_at: string;
          completed_by: string | null;
          completed_at: string | null;
          status: "pending" | "completed";
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          scheduled_at: string;
          created_by?: string | null;
          created_at?: string;
          completed_by?: string | null;
          completed_at?: string | null;
          status?: "pending" | "completed";
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          scheduled_at?: string;
          created_by?: string | null;
          created_at?: string;
          completed_by?: string | null;
          completed_at?: string | null;
          status?: "pending" | "completed";
          updated_at?: string;
        };
      };
    };
  };
}

// Helper types for easier usage
export type Owner = Database["public"]["Tables"]["owners"]["Row"];
export type Portfolio = Database["public"]["Tables"]["portfolios"]["Row"];
export type Account = Database["public"]["Tables"]["accounts"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type TrackedSymbol = Database["public"]["Tables"]["tracked_symbols"]["Row"];
export type AppSettings = Database["public"]["Tables"]["app_settings"]["Row"];
export type OwnerDashboard = Database["public"]["Tables"]["owner_dashboards"]["Row"];
export type OwnerSettings = Database["public"]["Tables"]["owner_settings"]["Row"];
export type SellPlan = Database["public"]["Tables"]["sell_plans"]["Row"];
export type Tag = Database["public"]["Tables"]["tags"]["Row"];
export type SymbolNote = Database["public"]["Tables"]["symbol_notes"]["Row"];
export type SymbolTag = Database["public"]["Tables"]["symbol_tags"]["Row"];
export type TagGrouping = Database["public"]["Tables"]["tag_groupings"]["Row"];
export type CostBasisOverride = Database["public"]["Tables"]["cost_basis_overrides"]["Row"];
export type SellPlanProgress = Database["public"]["Tables"]["sell_plan_progress"]["Row"];
export type AllocationSnapshot = Database["public"]["Tables"]["allocation_snapshots"]["Row"];
export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type RunningTabRow = Database["public"]["Tables"]["running_tab"]["Row"];
export type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];
export type TabHistoryRow = Database["public"]["Tables"]["tab_history"]["Row"];
export type AppPermissionsRow = Database["public"]["Tables"]["app_permissions"]["Row"];
export type ScheduledEventRow = Database["public"]["Tables"]["scheduled_events"]["Row"];

// Portfolio with nested accounts
export type PortfolioWithAccounts = Portfolio & {
  accounts: Account[];
};
