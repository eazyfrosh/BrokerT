import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <Logo className="justify-center" />

        <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <FileQuestion className="size-6" aria-hidden />
        </span>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            That page does not exist, or you do not have access to it. Check the address, or head back to
            somewhere familiar.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/dashboard">Go to your dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
