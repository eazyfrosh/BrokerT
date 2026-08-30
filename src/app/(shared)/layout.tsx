import { MarketingHeader } from "@/components/layout/marketing-header";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { AppShell } from "@/components/layout/app-shell";
import { getSessionContext } from "@/lib/auth";

/**
 * Chrome for routes that are browsable signed out and part of the product when
 * signed in — markets, strategies and the vehicle marketplace.
 */
export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext();

  if (session && session.profile.account_status === "active") {
    return <AppShell profile={session.profile}>{children}</AppShell>;
  }

  return (
    <>
      <MarketingHeader signedIn={Boolean(session)} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </>
  );
}
