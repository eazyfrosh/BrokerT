import { DatabaseZap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isSupabaseConfigured } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * Rendered wherever data is expected but the Supabase project has not been
 * configured yet. Keeps a fresh clone usable instead of throwing.
 */
export function SetupNotice({ className, what = "this data" }: { className?: string; what?: string }) {
  if (isSupabaseConfigured) return null;
  return (
    <Alert variant="warning" className={cn(className)}>
      <DatabaseZap />
      <AlertTitle>Connect Supabase to load {what}</AlertTitle>
      <AlertDescription>
        Set <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then run the migrations in{" "}
        <code className="font-mono text-xs">supabase/migrations</code>. See the README for the full setup.
      </AlertDescription>
    </Alert>
  );
}
