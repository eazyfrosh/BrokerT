import type { Metadata } from "next";
import { Cog, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/page-header";
import { SetupNotice } from "@/components/shared/setup-notice";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { getRequestOrigin } from "@/lib/request-origin";
import { formatDateTime } from "@/lib/format";
import { APP, DEMO_MODE, publicEnv, serverEnv } from "@/lib/config";
import type { SystemSetting } from "@/types/database";

export const metadata: Metadata = { title: "Settings · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await requireAdmin();

  const supabase = await createClient();
  const { data: settings } = supabase
    ? await supabase.from("system_settings").select("*").order("key").returns<SystemSetting[]>()
    : { data: [] as SystemSetting[] };

  const env = serverEnv();

  const environment: [string, string][] = [
    ["Supabase URL", publicEnv.supabaseUrl ? "Configured" : "Not set"],
    ["Supabase anon key", publicEnv.supabaseAnonKey ? "Configured" : "Not set"],
    ["Service role key", env.supabaseServiceRoleKey ? "Configured (server only)" : "Not set"],
    ["Application origin", await getRequestOrigin()],
    ["Demo mode", DEMO_MODE ? "On" : "Off"],
    ["Market data provider", env.marketDataProvider],
    ["Market data API key", env.marketDataApiKey ? "Configured" : "Not set"],
    ["Email provider", env.resendApiKey ? "Resend" : "Not configured (logging only)"],
    ["Email sender", env.emailFrom],
    ["Admin bootstrap email", env.adminEmail ?? "Not set"],
    ["Admin setup secret", env.adminSetupSecret ? "Configured" : "Not set"],
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Platform settings"
        description="How this deployment is configured, and the switches stored in the database."
      />

      <SetupNotice what="platform settings" />

      <Alert variant="warning">
        <Cog />
        <AlertTitle>Configuration lives in the environment</AlertTitle>
        <AlertDescription>
          Secrets are read from environment variables and are never rendered here — only whether each one
          is present. Change them in your deployment configuration and redeploy; nothing on this page
          writes a secret.
        </AlertDescription>
      </Alert>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Environment</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              {environment.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="truncate text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database settings</CardTitle>
          </CardHeader>
          <CardContent>
            {(settings ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No settings rows found.</p>
            ) : (
              <ul className="divide-y divide-border">
                {(settings ?? []).map((setting) => (
                  <li key={setting.key} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-sm font-medium">{setting.key}</p>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(setting.updated_at)}
                      </span>
                    </div>
                    {setting.description && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {setting.description}
                      </p>
                    )}
                    <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-muted/40 p-2.5 text-xs scrollbar-thin">
                      {JSON.stringify(setting.value, null, 2)}
                    </pre>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <ShieldCheck className="size-4 text-warning" aria-hidden />
          <CardTitle>Your access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">
              {session.profile.role === "super_admin" ? "Super admin" : "Admin"}
            </Badge>
            <span className="text-sm text-muted-foreground">{session.profile.email}</span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Administrative reach is granted by your profile role and enforced by Row Level Security, not
            by this interface. Only a super administrator can grant or revoke administrative access, and
            no administrator can change their own role or account status.
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">{APP.trademarkNotice}</p>
        </CardContent>
      </Card>
    </div>
  );
}
