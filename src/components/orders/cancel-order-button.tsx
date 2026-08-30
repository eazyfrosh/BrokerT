"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cancelOrderAction } from "@/lib/actions/orders";

export function CancelOrderButton({
  orderId,
  reference,
  ...props
}: { orderId: string; reference: string } & ButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function confirm() {
    setLoading(true);
    const result = await cancelOrderAction(orderId);
    setLoading(false);
    setOpen(false);

    if (result.ok) {
      toast.success("Order cancelled", { description: `Reference ${reference}` });
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" {...props} onClick={() => setOpen(true)}>
        {props.children ?? "Cancel order"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancel this order?"
        description={
          <>
            Order <span className="font-mono font-medium">{reference}</span> will be cancelled and any
            cash it reserved will be returned to your available balance. This cannot be undone.
          </>
        }
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        destructive
        loading={loading}
        onConfirm={confirm}
      />
    </>
  );
}
