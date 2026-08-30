import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { SetupNotice } from "@/components/shared/setup-notice";
import { SimulatedDataNotice } from "@/components/shared/demo-notices";
import { WatchlistManager } from "@/components/watchlist/watchlist-manager";
import { getMyWatchlist, listAvailableAssets } from "@/lib/services/watchlist";
import { getQuote } from "@/lib/services/market";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Watchlist" };
export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  await requireSession("/watchlist");

  // Read the primary quote first so the demo engine advances the stored price
  // before the watchlist reads it.
  await getQuote().catch(() => null);

  const { items } = await getMyWatchlist();
  const available = await listAvailableAssets(items.map((item) => item.asset_id));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Watchlist"
        description="Instruments you are following, with their current simulated quote."
      />

      <SetupNotice what="your watchlist" />
      <WatchlistManager items={items} available={available} />
      <SimulatedDataNotice />
    </div>
  );
}
