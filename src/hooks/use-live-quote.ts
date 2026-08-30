"use client";

import * as React from "react";
import type { MarketStatus, Quote } from "@/lib/market/types";

interface LiveQuoteState {
  quote: Quote;
  status: MarketStatus | null;
  /** Direction of the most recent price change, for the flash animation. */
  tick: "up" | "down" | null;
  stale: boolean;
}

/**
 * Polls the quote endpoint and reports the direction of each change.
 *
 * Polling (rather than a Realtime subscription) is deliberate: the demo engine
 * advances the stored quote lazily when it is read, so a read is what makes
 * the market move. The interval pauses while the tab is hidden.
 */
export function useLiveQuote(initialQuote: Quote, intervalMs = 5000): LiveQuoteState {
  const [quote, setQuote] = React.useState(initialQuote);
  const [status, setStatus] = React.useState<MarketStatus | null>(null);
  const [tick, setTick] = React.useState<"up" | "down" | null>(null);
  const [stale, setStale] = React.useState(false);
  const previousPrice = React.useRef(initialQuote.price);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      if (document.visibilityState === "hidden") {
        schedule();
        return;
      }
      try {
        const response = await fetch(
          `/api/market/quote?symbol=${encodeURIComponent(initialQuote.symbol)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error(String(response.status));
        const payload = (await response.json()) as { quote: Quote; status: MarketStatus };
        if (cancelled) return;

        setQuote(payload.quote);
        setStatus(payload.status);
        setStale(false);

        const delta = payload.quote.price - previousPrice.current;
        if (delta !== 0) {
          setTick(delta > 0 ? "up" : "down");
          previousPrice.current = payload.quote.price;
        }
      } catch {
        if (!cancelled) setStale(true);
      } finally {
        schedule();
      }
    }

    function schedule() {
      if (!cancelled) timer = setTimeout(poll, intervalMs);
    }

    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [initialQuote.symbol, intervalMs]);

  // Clear the flash so it reads as a pulse rather than a permanent colour.
  React.useEffect(() => {
    if (!tick) return;
    const timer = setTimeout(() => setTick(null), 700);
    return () => clearTimeout(timer);
  }, [tick, quote.price]);

  return { quote, status, tick, stale };
}
