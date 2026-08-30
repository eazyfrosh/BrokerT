"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { signOutOtherSessionsAction } from "@/lib/actions/auth";

export function SignOutOtherSessionsButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function confirm() {
    setLoading(true);
    const result = await signOutOtherSessionsAction();
    setLoading(false);
    setOpen(false);

    if (result.ok) {
      toast.success(result.message ?? "Other sessions signed out");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <LogOut /> Sign out other sessions
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Sign out everywhere else?"
        description="Every session other than this one will be signed out immediately. You will stay signed in here."
        confirmLabel="Sign out others"
        loading={loading}
        onConfirm={confirm}
      />
    </>
  );
}
