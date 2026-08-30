"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cancelCarOrderAction } from "@/lib/actions/cars";

export function CancelCarOrderButton({
  orderId,
  reference,
  ...props
}: { orderId: string; reference: string } & ButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function confirm() {
    setLoading(true);
    const result = await cancelCarOrderAction(orderId);
    setLoading(false);
    setOpen(false);

    if (result.ok) {
      toast.success("Order request cancelled");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" {...props} onClick={() => setOpen(true)}>
        {props.children ?? "Cancel request"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancel this order request?"
        description={
          <>
            Request <span className="font-mono font-medium">{reference}</span> will be cancelled. You can
            always build a new configuration afterwards.
          </>
        }
        confirmLabel="Cancel request"
        cancelLabel="Keep request"
        destructive
        loading={loading}
        onConfirm={confirm}
      />
    </>
  );
}
