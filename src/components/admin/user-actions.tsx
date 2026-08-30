"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  adminUpdateUserStatusAction,
  adminUpdateUserRoleAction,
  adminUpdateKycAction,
} from "@/lib/actions/admin";
import type { AccountStatus, KycStatus, UserRole } from "@/types/database";

export function SuspendUserButton({
  userId,
  email,
  suspended,
}: {
  userId: string;
  email: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function confirm() {
    setLoading(true);
    const result = await adminUpdateUserStatusAction({
      userId,
      status: suspended ? "active" : "suspended",
      reason: suspended ? "" : reason,
    });
    setLoading(false);
    setOpen(false);

    if (result.ok) {
      toast.success(suspended ? "Account reactivated" : "Account suspended");
      setReason("");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <Button
        variant={suspended ? "outline" : "destructive"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {suspended ? <RotateCcw /> : <Ban />}
        {suspended ? "Reactivate" : "Suspend"}
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={suspended ? "Reactivate this account?" : "Suspend this account?"}
        description={
          suspended
            ? `${email} will regain access to trading, allocations and funding.`
            : `${email} will be blocked from trading, allocations and funding, and will be told their account is not active. This is recorded in the audit log.`
        }
        confirmLabel={suspended ? "Reactivate" : "Suspend account"}
        destructive={!suspended}
        loading={loading}
        onConfirm={confirm}
      >
        {!suspended && (
          <div className="space-y-1.5">
            <Label htmlFor="suspend-reason">Reason (shown to the customer)</Label>
            <Textarea
              id="suspend-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why access is being paused."
            />
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}

export function RoleSelect({
  userId,
  role,
  canEdit,
}: {
  userId: string;
  role: UserRole;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  if (!canEdit) {
    return (
      <p className="text-xs text-muted-foreground">
        Only a super administrator can change roles.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="user-role">Role</Label>
      <Select
        value={role}
        disabled={pending}
        onValueChange={(value) =>
          startTransition(async () => {
            const result = await adminUpdateUserRoleAction({ userId, role: value as UserRole });
            if (result.ok) {
              toast.success("Role updated");
              router.refresh();
            } else {
              toast.error(result.error);
            }
          })
        }
      >
        <SelectTrigger id="user-role">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="user">User</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="super_admin">Super admin</SelectItem>
        </SelectContent>
      </Select>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
        Role changes are audited and cannot be applied to your own account.
      </p>
    </div>
  );
}

export function KycSelect({ userId, status }: { userId: string; status: KycStatus }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="space-y-1.5">
      <Label htmlFor="kyc-status">Verification status</Label>
      <Select
        value={status}
        disabled={pending}
        onValueChange={(value) =>
          startTransition(async () => {
            const result = await adminUpdateKycAction({ userId, status: value as KycStatus, note: "" });
            if (result.ok) {
              toast.success("Verification status updated");
              router.refresh();
            } else {
              toast.error(result.error);
            }
          })
        }
      >
        <SelectTrigger id="kyc-status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="not_started">Not started</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function StatusSelect({ userId, status }: { userId: string; status: AccountStatus }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="space-y-1.5">
      <Label htmlFor="account-status">Account status</Label>
      <Select
        value={status}
        disabled={pending}
        onValueChange={(value) =>
          startTransition(async () => {
            const result = await adminUpdateUserStatusAction({
              userId,
              status: value as AccountStatus,
              reason: "",
            });
            if (result.ok) {
              toast.success("Account status updated");
              router.refresh();
            } else {
              toast.error(result.error);
            }
          })
        }
      >
        <SelectTrigger id="account-status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="suspended">Suspended</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
