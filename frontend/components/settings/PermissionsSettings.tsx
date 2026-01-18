"use client";

import { useOwnerStore } from "@/stores/ownerStore";
import { usePermissionsStore } from "@/stores/permissionsStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CreatorAvatar } from "@/components/tasks/CreatorAvatar";

export function PermissionsSettings() {
  const owners = useOwnerStore((state) => state.owners);
  const permissions = usePermissionsStore((state) => state.permissions);
  const setCanCompleteTasks = usePermissionsStore((state) => state.setCanCompleteTasks);
  const setCanApproveExpenses = usePermissionsStore((state) => state.setCanApproveExpenses);
  const initializePermissions = usePermissionsStore((state) => state.initializePermissions);

  // Get non-master users
  const regularUsers = owners.filter((owner) => !owner.isMaster);

  // Ensure permissions exist for all users
  regularUsers.forEach((owner) => {
    if (!permissions[owner.id]) {
      initializePermissions(owner.id);
    }
  });

  if (regularUsers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Permissions</CardTitle>
          <CardDescription>
            No regular users to configure. Add users in Owner Management first.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Permissions</CardTitle>
        <CardDescription>
          Configure what each user can do. Master users always have all permissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {regularUsers.map((owner) => {
          const userPerms = permissions[owner.id];

          return (
            <div key={owner.id} className="space-y-4 pb-4 border-b last:border-b-0">
              <div className="flex items-center gap-3">
                <CreatorAvatar name={owner.name} size="md" />
                <span className="font-medium">{owner.name}</span>
              </div>

              <div className="grid gap-4 pl-11">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`complete-${owner.id}`} className="flex flex-col gap-1">
                    <span>Can Complete Tasks</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      Allow this user to check off tasks as completed
                    </span>
                  </Label>
                  <Switch
                    id={`complete-${owner.id}`}
                    checked={userPerms?.canCompleteTasks ?? false}
                    onCheckedChange={(checked) => setCanCompleteTasks(owner.id, checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor={`approve-${owner.id}`} className="flex flex-col gap-1">
                    <span>Can Approve Expenses</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      Allow this user to approve or reject expense submissions
                    </span>
                  </Label>
                  <Switch
                    id={`approve-${owner.id}`}
                    checked={userPerms?.canApproveExpenses ?? false}
                    onCheckedChange={(checked) => setCanApproveExpenses(owner.id, checked)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
