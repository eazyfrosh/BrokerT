import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn, } from "@/lib/utils";
import { titleCase } from "@/lib/format";

type Variant = NonNullable<BadgeProps["variant"]>;

/**
 * One place that decides what colour a status is, so an order, a transaction
 * and a vehicle order never disagree about what "cancelled" looks like.
 */
const STATUS_VARIANTS: Record<string, Variant> = {
  // Orders
  pending: "warning",
  submitted: "default",
  partially_filled: "default",
  filled: "success",
  cancelled: "muted",
  rejected: "destructive",
  // Transactions
  processing: "default",
  completed: "success",
  failed: "destructive",
  // Accounts
  active: "success",
  suspended: "destructive",
  closed: "muted",
  // KYC
  not_started: "muted",
  approved: "success",
  // Investment products
  draft: "muted",
  open: "success",
  paused: "warning",
  archived: "muted",
  // Investment positions
  matured: "default",
  withdrawn: "muted",
  // Vehicle orders
  configuration: "muted",
  order_request: "warning",
  confirmed: "default",
  preparing: "default",
  ready: "success",
  // Support
  resolved: "success",
  // Roles
  user: "muted",
  admin: "default",
  super_admin: "warning",
};

export function StatusBadge({
  status,
  className,
  label,
}: {
  status: string;
  className?: string;
  label?: string;
}) {
  const variant = STATUS_VARIANTS[status] ?? "secondary";
  return (
    <Badge variant={variant} className={cn("capitalize", className)}>
      {label ?? titleCase(status)}
    </Badge>
  );
}
