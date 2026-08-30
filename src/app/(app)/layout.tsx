import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return <AppShell profile={session.profile}>{children}</AppShell>;
}
