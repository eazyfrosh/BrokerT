import Link from "next/link";
import { cn } from "@/lib/utils";
import { APP } from "@/lib/config";

/**
 * BrokerT's own mark — deliberately unrelated to any vehicle-manufacturer
 * branding, so the platform never reads as an official Tesla property.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17.5 9 11l4 4 8-8.5" />
        <path d="M15 6.5h6v6" />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  href = "/",
  showWordmark = true,
}: {
  className?: string;
  href?: string;
  showWordmark?: boolean;
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <LogoMark />
      {showWordmark && <span className="text-base">{APP.name}</span>}
      <span className="sr-only">{APP.name} home</span>
    </Link>
  );
}
