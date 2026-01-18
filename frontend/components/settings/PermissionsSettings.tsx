"use client";

import { useOwnerStore } from "@/stores/ownerStore";
import { usePermissionsStore } from "@/stores/permissionsStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CreatorAvatar } from "@/components/tasks/CreatorAvatar";
import { Shield, CheckCircle, Wallet } from "lucide-react";

export function PermissionsSettings() {
  const owners = useOwnerStore((state) => state.owners);
  const setOwnerMaster = useOwnerStore((state) => state.setOwnerMaster);
  const getActiveOwnerId = useOwnerStore((state) => state.getActiveOwnerId);
  const permissions = usePermissionsStore((state) => state.permissions);
  const setCanApproveExpenses = usePermissionsStore((state) => state.setCanApproveExpenses);
  const initializePermissions = usePermissionsStore((state) => state.initializePermissions);

  const currentUserId = getActiveOwnerId();

  // Ensure permissions exist for all non-master users
  owners.forEach((owner) => {
    if (!owner.isMaster && !permissions[owner.id]) {
      initializePermissions(owner.id);
    }
  });

  if (owners.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Accounts & Permissions</CardTitle>
          <CardDescription>
            No users found. Create an account first.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Accounts & Permissions</CardTitle>
        <CardDescription>
          View all accounts and configure permissions. Admins have full access to all features.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {owners.map((owner) => {
          const userPerms = permissions[owner.id];
          const isCurrentUser = owner.id === currentUserId;

          return (
            <div key={owner.id} className="space-y-4 pb-4 border-b last:border-b-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreatorAvatar name={owner.name} size="md" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{owner.name}</span>
                      {isCurrentUser && (
                        <Badge variant="outline" className="text-xs">You</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {owner.isMaster ? (
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">User</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Permissions summary / controls */}
              <div className="grid gap-3 pl-11">
                {/* Admin toggle - can't remove your own admin status */}
                <div className="flex items-center justify-between">
                  <Label htmlFor={`admin-${owner.id}`} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-amber-500" />
                      <span>Admin Privileges</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-normal">
                      Full access to all features, settings, and user management
                    </span>
                  </Label>
                  <Switch
                    id={`admin-${owner.id}`}
                    checked={owner.isMaster}
                    onCheckedChange={(checked) => setOwnerMaster(owner.id, checked)}
                    disabled={isCurrentUser}
                  />
                </div>

                {/* Show individual permissions for non-admins */}
                {!owner.isMaster && (
                  <>
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`complete-${owner.id}`} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>Complete Tasks</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-normal">
                          All users can complete tasks
                        </span>
                      </Label>
                      <Badge variant="outline" className="text-green-600">Always On</Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor={`approve-${owner.id}`} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-blue-500" />
                          <span>Approve Expenses</span>
                        </div>
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
                  </>
                )}

                {/* Show all permissions enabled for admins */}
                {owner.isMaster && (
                  <div className="text-sm text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                    <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">Admin Access</p>
                    <ul className="space-y-1 text-amber-600 dark:text-amber-300">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3" /> Complete tasks
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3" /> Approve expenses
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3" /> Initialize running tab
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3" /> Manage users & permissions
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
