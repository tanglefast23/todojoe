"use client";

import { useState, useEffect } from "react";
import { Download, Upload, Trash2 } from "lucide-react";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTagsStore } from "@/stores/tagsStore";
import { useTasksStore } from "@/stores/tasksStore";
import { useRunningTabStore } from "@/stores/runningTabStore";
import { usePermissionsStore } from "@/stores/permissionsStore";
import { useOwnerStore } from "@/stores/ownerStore";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { OwnerManagement } from "@/components/settings/OwnerManagement";
import { PermissionsSettings } from "@/components/settings/PermissionsSettings";

export default function SettingsPage() {
  // Redirect to login if not authenticated
  const { isLoading: isAuthLoading, isAuthenticated } = useAuthGuard();

  const tagsStore = useTagsStore();
  const tasksStore = useTasksStore();
  const runningTabStore = useRunningTabStore();
  const permissionsStore = usePermissionsStore();
  const isMasterLoggedIn = useOwnerStore((state) => state.isMasterLoggedIn);

  // Hydration-safe check for master status
  const [isMounted, setIsMounted] = useState(false);
  const [clearDataOpen, setClearDataOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const showOwnerManagement = isMounted && isMasterLoggedIn();

  // Show loading state while checking authentication
  if (isAuthLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const handleExport = () => {
    // Export all task-related data
    const data = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      tasks: tasksStore.tasks,
      runningTab: {
        tab: runningTabStore.tab,
        expenses: runningTabStore.expenses,
        history: runningTabStore.history,
      },
      permissions: permissionsStore.permissions,
      tags: tagsStore.tags,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jv-todo-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validate data structure
        if (!data.version) {
          alert("Invalid backup file format");
          return;
        }

        // Import tasks
        if (data.tasks) {
          tasksStore.setTasks(data.tasks);
        }

        // Import running tab data
        if (data.runningTab) {
          if (data.runningTab.tab) {
            runningTabStore.setTab(data.runningTab.tab);
          }
          if (data.runningTab.expenses) {
            runningTabStore.setExpenses(data.runningTab.expenses);
          }
          if (data.runningTab.history) {
            runningTabStore.setHistory(data.runningTab.history);
          }
        }

        // Import permissions
        if (data.permissions) {
          permissionsStore.setPermissions(data.permissions);
        }

        // Import tags
        if (data.tags) {
          tagsStore.setTags(data.tags);
        }

        alert("Data imported successfully! Page will reload to apply changes.");
        window.location.reload();
      } catch (error) {
        console.error("Import error:", error);
        alert("Failed to import data. Please check the file format.");
      }
    };
    input.click();
  };

  const handleClearAllData = () => {
    setClearDataOpen(true);
  };

  const confirmClearAllData = async () => {
    setIsClearing(true);

    try {
      // Clear local stores
      tasksStore.setTasks([]);
      runningTabStore.setTab(null);
      runningTabStore.setExpenses([]);
      runningTabStore.setHistory([]);
      permissionsStore.setPermissions({});
      tagsStore.setTags([]);

      // Clear localStorage (preserving owner accounts)
      const keysToPreserve = ["owner-storage", "active-owner-id"];
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (!keysToPreserve.includes(key)) {
          localStorage.removeItem(key);
        }
      });

      // Clear sessionStorage
      sessionStorage.clear();

      setIsClearing(false);
      window.location.reload();
    } catch (error) {
      console.error("Error clearing data:", error);
      setIsClearing(false);
    }
  };

  return (
    <div className="flex flex-col">
      <Header />

      <div className="flex-1 space-y-6 p-6">
        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>
              Export or import your tasks and expenses data as JSON backup
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button onClick={handleExport} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export Data
              </Button>
              <Button onClick={handleImport} variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Import Data
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Owner Profiles - Master Only */}
        {showOwnerManagement && <OwnerManagement />}

        {/* User Permissions - Master Only */}
        {showOwnerManagement && <PermissionsSettings />}

        {/* Danger Zone */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions - proceed with caution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleClearAllData} disabled={isClearing}>
              <Trash2 className="mr-2 h-4 w-4" />
              {isClearing ? "Clearing..." : "Clear All Data"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={clearDataOpen}
        onOpenChange={setClearDataOpen}
        title="Clear All Data"
        description="Are you sure you want to clear all data? This will permanently delete all tasks, expenses, and settings. Your account profile will be preserved. This action cannot be undone."
        confirmLabel="Clear All Data"
        cancelLabel="Cancel"
        onConfirm={confirmClearAllData}
        variant="destructive"
      />
    </div>
  );
}
