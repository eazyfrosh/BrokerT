import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { SetupNotice } from "@/components/shared/setup-notice";
import { SettingsForm } from "@/components/account/settings-form";
import { getMySettings } from "@/lib/services/account";
import { requireSession } from "@/lib/auth";
import { APP, DEMO_MODE, publicEnv } from "@/lib/config";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireSession("/settings");
  const settings = await getMySettings();

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Appearance and notification preferences." />

      <SetupNotice what="your preferences" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsForm settings={settings} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              {[
                ["Mode", DEMO_MODE ? "Demo (simulated)" : "Live"],
                ["Market data", "Simulated demo engine"],
                ["Base currency", settings?.base_currency ?? "USD"],
                ["Application", APP.name],
                ["Origin", publicEnv.appUrl],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="truncate text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {APP.trademarkNotice}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
