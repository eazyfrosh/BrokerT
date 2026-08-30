"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { PerformanceBadge } from "@/components/shared/performance-badge";
import { addToWatchlistAction, removeFromWatchlistAction } from "@/lib/actions/watchlist";
import { formatCurrency } from "@/lib/format";
import { round } from "@/lib/utils";
import type { Asset } from "@/types/database";
import type { WatchlistEntry } from "@/lib/services/watchlist";

export function WatchlistManager({
  items,
  available,
}: {
  items: WatchlistEntry[];
  available: Asset[];
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function add() {
    if (!selected) return;
    startTransition(async () => {
      const result = await addToWatchlistAction({ assetId: selected, note: "" });
      if (result.ok) {
        toast.success(result.message ?? "Added");
        setSelected("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(itemId: string, symbol: string) {
    startTransition(async () => {
      const result = await removeFromWatchlistAction(itemId);
      if (result.ok) {
        toast.success(`${symbol} removed from your watchlist`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      {available.length > 0 && (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <label htmlFor="watchlist-add" className="text-sm font-medium">
              Add an instrument
            </label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger id="watchlist-add">
                <SelectValue placeholder="Select an instrument" />
              </SelectTrigger>
              <SelectContent>
                {available.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.symbol} · {asset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={add} disabled={!selected || pending} loading={pending}>
            <Plus /> Add
          </Button>
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Your watchlist is empty"
          description="Add an instrument to follow its price alongside your portfolio."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const quote = item.assets?.market_quotes ?? null;
            const change = quote ? round(Number(quote.price) - Number(quote.previous_close), 2) : 0;
            const changePercent =
              quote && Number(quote.previous_close) > 0
                ? round((change / Number(quote.previous_close)) * 100, 2)
                : 0;

            return (
              <Card key={item.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold">{item.assets?.symbol ?? "—"}</h2>
                      {item.assets?.exchange && (
                        <Badge variant="outline" className="text-[0.625rem]">
                          {item.assets.exchange}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {item.assets?.name ?? ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${item.assets?.symbol ?? "instrument"} from watchlist`}
                    disabled={pending}
                    onClick={() => remove(item.id, item.assets?.symbol ?? "Instrument")}
                  >
                    <Trash2 />
                  </Button>
                </div>

                <div className="mt-4">
                  <p className="text-2xl font-semibold tabular">
                    {quote ? formatCurrency(Number(quote.price)) : "—"}
                  </p>
                  {quote && (
                    <PerformanceBadge
                      value={change}
                      percent={changePercent}
                      format="currency"
                      size="sm"
                      className="mt-1"
                    />
                  )}
                </div>

                {quote && (
                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Day high</dt>
                      <dd className="mt-0.5 tabular">{formatCurrency(Number(quote.day_high))}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Day low</dt>
                      <dd className="mt-0.5 tabular">{formatCurrency(Number(quote.day_low))}</dd>
                    </div>
                  </dl>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/markets">Markets</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/trade">Trade</Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
