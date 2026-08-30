import type { Metadata } from "next";
import Link from "next/link";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SetupNotice } from "@/components/shared/setup-notice";
import { ProfileForm } from "@/components/account/profile-form";
import { requireSession, displayName } from "@/lib/auth";
import { formatDate, formatDateTime, initialsOf } from "@/lib/format";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireSession("/profile");
  const { profile } = session;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Profile"
        description="Your personal and contact details."
        actions={
          <Button asChild variant="outline">
            <Link href="/security">
              <Shield /> Security
            </Link>
          </Button>
        }
      />

      <SetupNotice what="your profile" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <CardHeader>
            <CardTitle>Personal information</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm profile={profile} />
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-12">
                  {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
                  <AvatarFallback className="text-sm">
                    {initialsOf(profile.first_name, profile.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{displayName(profile)}</p>
                  <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
                </div>
              </div>

              <dl className="divide-y divide-border">
                {[
                  ["Account status", <StatusBadge key="s" status={profile.account_status} />],
                  ["Role", <StatusBadge key="r" status={profile.role} />],
                  ["Verification", <StatusBadge key="k" status={profile.kyc_status} />],
                  [
                    "Email verified",
                    profile.email_verified_at ? formatDate(profile.email_verified_at) : "Not verified",
                  ],
                  ["Member since", formatDate(profile.created_at)],
                  [
                    "Last sign-in",
                    profile.last_login_at ? formatDateTime(profile.last_login_at) : "—",
                  ],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Identity verification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Verification is not required in demo mode. A production deployment would collect and
                verify identity documents here through a licensed provider before enabling funding or
                trading with real money.
              </p>
              <StatusBadge status={profile.kyc_status} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
