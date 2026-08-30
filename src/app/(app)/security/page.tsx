import type { Metadata } from "next";
import { KeyRound, Laptop, ShieldCheck, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/page-header";
import { SetupNotice } from "@/components/shared/setup-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { SignOutOtherSessionsButton } from "@/components/account/session-controls";
import { listMyLoginEvents } from "@/lib/services/account";
import { requireSession } from "@/lib/auth";
import { formatDateTime, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Security" };
export const dynamic = "force-dynamic";

/** Coarse device class from a user-agent string — enough to recognise a session. */
function deviceOf(userAgent: string | null): { label: string; mobile: boolean } {
  if (!userAgent) return { label: "Unknown device", mobile: false };
  const mobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
  const browser = /Edg/i.test(userAgent)
    ? "Edge"
    : /Chrome/i.test(userAgent)
      ? "Chrome"
      : /Safari/i.test(userAgent)
        ? "Safari"
        : /Firefox/i.test(userAgent)
          ? "Firefox"
          : "Browser";
  const platform = /Windows/i.test(userAgent)
    ? "Windows"
    : /Mac OS/i.test(userAgent)
      ? "macOS"
      : /Android/i.test(userAgent)
        ? "Android"
        : /iPhone|iPad|iOS/i.test(userAgent)
          ? "iOS"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : "Unknown";
  return { label: `${browser} on ${platform}`, mobile };
}

export default async function SecurityPage() {
  const session = await requireSession("/security");
  const events = await listMyLoginEvents(30);

  // One entry per distinct device seen recently.
  const devices = new Map<string, { label: string; mobile: boolean; lastSeen: string }>();
  for (const event of events) {
    const device = deviceOf(event.user_agent);
    if (!devices.has(device.label)) {
      devices.set(device.label, { ...device, lastSeen: event.created_at });
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Security"
        description="Your password, sign-in history and the devices that have reached your account."
      />

      <SetupNotice what="your security history" />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Two-factor authentication</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={session.profile.two_factor_enabled ? "success" : "muted"}>
                  {session.profile.two_factor_enabled ? "Enabled" : "Not enabled"}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                The account model and interface already carry a two-factor flag, and the platform&apos;s
                identity provider supports TOTP enrolment. Enrolment is not switched on in demo mode
                because it would lock demo accounts out of a simulated environment with no recovery path.
              </p>
              <Alert variant="info">
                <ShieldCheck />
                <AlertTitle>Before going live</AlertTitle>
                <AlertDescription>
                  Enable TOTP enrolment in the identity provider, require it for administrative roles,
                  and issue recovery codes at enrolment time.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active sessions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                If you no longer recognise a device below, sign out everywhere else and change your
                password.
              </p>
              <SignOutOtherSessionsButton />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Devices seen recently</CardTitle>
          </CardHeader>
          <CardContent>
            {devices.size === 0 ? (
              <EmptyState title="No devices recorded" compact />
            ) : (
              <ul className="divide-y divide-border">
                {[...devices.entries()].map(([label, device]) => {
                  const Icon = device.mobile ? Smartphone : Laptop;
                  return (
                    <li key={label} className="flex items-center gap-3 py-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          Last seen {formatDateTime(device.lastSeen)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sign-in history</CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <EmptyState icon={KeyRound} title="No activity recorded yet" compact />
            ) : (
              <ul className="divide-y divide-border">
                {events.slice(0, 12).map((event) => (
                  <li key={event.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{titleCase(event.event)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {deviceOf(event.user_agent).label}
                        {event.ip_address ? ` · ${event.ip_address}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</p>
                      {!event.succeeded && (
                        <Badge variant="destructive" className="mt-1">
                          Failed
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Locking your account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            If you believe your account has been reached by someone else, change your password and sign
            out other sessions immediately, then contact support. Support can suspend the account, which
            blocks trading, allocations and funding until it is restored.
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Account status is administered by the platform team and cannot be changed from this page —
            the database rejects any attempt by an account to alter its own status or role.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
