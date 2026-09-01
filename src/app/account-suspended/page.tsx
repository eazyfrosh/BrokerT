import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/shared/logo";
import { getSessionContext } from "@/lib/auth";
import { LogoutButton } from "@/components/layout/logout-button";
import { APP } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account unavailable",
  robots: { index: false, follow: false },
};

export default async function AccountSuspendedPage() {
  const session = await getSessionContext();
  const reason = session?.profile?.suspension_reason ?? null;

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-md space-y-6">
        <Logo className="justify-center" />

        <Card className="space-y-4 p-6 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/12 text-destructive">
            <ShieldAlert className="size-6" aria-hidden />
          </span>
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold">This account is not active</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Access to trading, investing and account funding is paused. Our team can explain what is
              needed to restore it.
            </p>
          </div>

          {reason && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-left">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reason given
              </p>
              <p className="mt-1 text-sm">{reason}</p>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button asChild>
              <Link href="/contact">Contact support</Link>
            </Button>
            <LogoutButton variant="outline" className="w-full" />
          </div>
        </Card>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {APP.trademarkNotice}
        </p>
      </div>
    </main>
  );
}
