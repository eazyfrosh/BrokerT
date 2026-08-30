import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { DemoBadge, TrademarkNotice } from "@/components/shared/demo-notices";
import { APP } from "@/lib/config";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[1fr_1.1fr]">
      {/* Form column */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Logo />
          <div className="flex items-center gap-2">
            <DemoBadge />
            <ThemeToggle />
          </div>
        </header>

        <main id="main" className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-sm">{children}</div>
        </main>

        <footer className="px-5 py-6 sm:px-8">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/risk-disclosure" className="hover:text-foreground">Risk disclosure</Link>
          </div>
        </footer>
      </div>

      {/* Brand column */}
      <aside className="relative hidden overflow-hidden border-l border-border bg-muted/30 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_70%_10%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent)]"
        />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Independent Tesla-focused platform
          </p>
          <h2 className="mt-4 max-w-md text-3xl font-semibold leading-tight tracking-tight">
            {APP.tagline}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">{APP.description}</p>
        </div>

        <div className="relative space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Row Level Security", "Authorisation enforced in the database, not just the interface."],
              ["Derived valuations", "Portfolio figures computed from real holdings and live quotes."],
              ["Auditable ledger", "Every trade, fee and allocation written to an immutable record."],
              ["Swappable data layer", "Point the provider interface at a licensed feed when you are ready."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl border border-border bg-card/70 p-4 backdrop-blur-sm">
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
          <TrademarkNotice className="max-w-lg" />
        </div>
      </aside>
    </div>
  );
}
