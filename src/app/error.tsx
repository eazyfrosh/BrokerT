"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";

/**
 * Route-level error boundary.
 *
 * Renders the framework-provided digest only — never the message or stack, so
 * a backend error can never leak to a customer. The digest is enough for an
 * operator to find the matching server log.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[route-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <Logo className="justify-center" />

        <span className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/12 text-destructive">
          <AlertTriangle className="size-6" aria-hidden />
        </span>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We could not load this page. Nothing has been changed on your account. Try again, and if it
            keeps happening let support know.
          </p>
          {error.digest && (
            <p className="pt-1 font-mono text-xs text-muted-foreground/80">Reference {error.digest}</p>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>
            <RotateCw /> Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Go to your dashboard</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/support">Contact support</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
