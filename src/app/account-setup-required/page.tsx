import type { Metadata } from "next";
import Link from "next/link";
import { DatabaseZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/shared/logo";
import { LogoutButton } from "@/components/layout/logout-button";
import { getSessionContext } from "@/lib/auth";
import { APP } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account setup incomplete",
  robots: { index: false, follow: false },
};

/**
 * Reached when a session is valid but the account has no profile row and could
 * not be provisioned — which means the database schema is incomplete.
 *
 * This page exists to break a loop. Sending the person to /login would bounce
 * off the proxy, which sees a valid session on an auth route and redirects
 * back, forever. It is deliberately outside both the protected prefixes and
 * the auth routes so nothing redirects away from it.
 */
export default async function AccountSetupRequiredPage() {
  const session = await getSessionContext();

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-lg space-y-6">
        <Logo className="justify-center" />

        <Card className="space-y-5 p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-warning/15 text-warning">
              <DatabaseZap className="size-6" aria-hidden />
            </span>
            <div className="space-y-1.5">
              <h1 className="text-lg font-semibold">Your account is not set up yet</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                You are signed in{session?.user.email ? ` as ${session.user.email}` : ""}, but this
                account has no profile record. That happens when the database schema has not been
                fully applied, so there was nowhere to create one.
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-sm font-medium">To fix it</p>
            <ol className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li className="flex gap-2.5">
                <span className="font-semibold text-foreground">1.</span>
                <span>
                  Run <code className="font-mono text-xs">supabase/setup.sql</code> in the Supabase SQL
                  editor and check it finishes with{" "}
                  <span className="font-mono text-xs">OK. Database ready.</span>
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="font-semibold text-foreground">2.</span>
                <span>
                  Open <Link href="/api/health" className="font-medium text-primary hover:underline">/api/health</Link>{" "}
                  to confirm every table is reachable.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="font-semibold text-foreground">3.</span>
                <span>Reload this page. Your profile will be created automatically.</span>
              </li>
            </ol>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="flex-1">
              <Link href="/dashboard">Try again</Link>
            </Button>
            <LogoutButton variant="outline" className="flex-1" />
          </div>
        </Card>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {APP.trademarkNotice}
        </p>
      </div>
    </main>
  );
}
