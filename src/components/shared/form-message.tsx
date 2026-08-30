import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Non-field-specific form feedback, announced to assistive technology. */
export function FormMessage({
  variant,
  children,
  className,
}: {
  variant: "error" | "success";
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = variant === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
        variant === "error"
          ? "border-destructive/30 bg-destructive/8 text-destructive"
          : "border-success/30 bg-success/8 text-success",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="text-foreground/90">{children}</span>
    </div>
  );
}
