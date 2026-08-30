"use client";

import * as React from "react";
import type { MarketStatus, Quote } from "@/lib/market/types";

interface QuoteSnapshot {
  quote: Quote;
  status: MarketStatus | null;
  stale: boolean;
}

interface SymbolStore {
  snapshot: QuoteSnapshot;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setTimeout> | null;
  subscribers: number;
  intervalMs: number;
}

/**
 * One store per symbol, shared by every component on the page.
 *
 * Each `useLiveQuote` call used to run its own interval, so the header ticker,
 * the order ticket and the sidebar could each hold a different price on the
 * same screen — and each poll advanced the demo market again. A single poller
 * per symbol keeps every surface on one tick and one request.
 */
const stores = new Map<string, SymbolStore>();

function getStore(symbol: string, initialQuote: Quote, intervalMs: number): SymbolStore {
  let store = stores.get(symbol);
  if (!store) {
    store = {
      snapshot: { quote: initialQuote, status: null, stale: false },
      listeners: new Set(),
      timer: null,
      subscribers: 0,
      intervalMs,
    };
    stores.set(symbol, store);
  }
  // The fastest interested component wins, so a trading screen can poll more
  // often than a page that only shows a chip.
  store.intervalMs = Math.min(store.intervalMs, intervalMs);
  return store;
}

function publish(store: SymbolStore, snapshot: QuoteSnapshot) {
  store.snapshot = snapshot;
  for (const listener of store.listeners) listener();
}

async function poll(symbol: string) {
  const store = stores.get(symbol);
  if (!store) return;

  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    schedule(symbol);
    return;
  }

  try {
    const response = await fetch(`/api/market/quote?symbol=${encodeURIComponent(symbol)}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(String(response.status));
    const payload = (await response.json()) as { quote: Quote; status: MarketStatus };
    publish(store, { quote: payload.quote, status: payload.status, stale: false });
  } catch {
    publish(store, { ...store.snapshot, stale: true });
  } finally {
    schedule(symbol);
  }
}

function schedule(symbol: string) {
  const store = stores.get(symbol);
  if (!store || store.subscribers === 0) return;
  store.timer = setTimeout(() => void poll(symbol), store.intervalMs);
}

function subscribe(symbol: string, listener: () => void): () => void {
  const store = stores.get(symbol);
  if (!store) return () => {};

  store.listeners.add(listener);
  store.subscribers += 1;
  if (store.subscribers === 1) schedule(symbol);

  return () => {
    store.listeners.delete(listener);
    store.subscribers -= 1;
    if (store.subscribers === 0 && store.timer) {
      clearTimeout(store.timer);
      store.timer = null;
    }
  };
}

export interface LiveQuoteState {
  quote: Quote;
  status: MarketStatus | null;
  /** Direction of the most recent price change, for the flash animation. */
  tick: "up" | "down" | null;
  stale: boolean;
}

/**
 * Subscribes to the shared quote poller for a symbol and reports the direction
 * of each change. Polling pauses while the tab is hidden and stops entirely
 * once the last subscriber unmounts.
 */
export function useLiveQuote(initialQuote: Quote, intervalMs = 5000): LiveQuoteState {
  const symbol = initialQuote.symbol;

  // Created during render so the first `getSnapshot` has a value to return.
  getStore(symbol, initialQuote, intervalMs);

  const snapshot = React.useSyncExternalStore(
    React.useCallback((listener) => subscribe(symbol, listener), [symbol]),
    React.useCallback(
      () => getStore(symbol, initialQuote, intervalMs).snapshot,
      [symbol, initialQuote, intervalMs],
    ),
    // The server has no poller; render the quote it already sent.
    React.useCallback(
      () => ({ quote: initialQuote, status: null, stale: false }) as QuoteSnapshot,
      [initialQuote],
    ),
  );

  const [tick, setTick] = React.useState<"up" | "down" | null>(null);
  const previousPrice = React.useRef(initialQuote.price);

  React.useEffect(() => {
    const delta = snapshot.quote.price - previousPrice.current;
    if (delta === 0) return;

    previousPrice.current = snapshot.quote.price;
    setTick(delta > 0 ? "up" : "down");

    // Clear it so the change reads as a pulse rather than a permanent colour.
    const timer = setTimeout(() => setTick(null), 700);
    return () => clearTimeout(timer);
  }, [snapshot.quote.price]);

  return { quote: snapshot.quote, status: snapshot.status, tick, stale: snapshot.stale };
}
