import type { MarketStatus, MarketSessionState } from "./types";

/**
 * US equity session boundaries in Eastern Time. Holidays are not modelled —
 * a licensed provider supplies the real calendar in production.
 */
const OPEN_MINUTES = 9 * 60 + 30;
const CLOSE_MINUTES = 16 * 60;
const PRE_MARKET_MINUTES = 4 * 60;
const AFTER_HOURS_MINUTES = 20 * 60;

function easternParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const weekday = get("weekday");
  return { minutes: hour * 60 + minute, weekday };
}

export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const { minutes, weekday } = easternParts(now);
  const isWeekend = weekday === "Sat" || weekday === "Sun";

  let state: MarketSessionState = "closed";
  if (!isWeekend) {
    if (minutes >= OPEN_MINUTES && minutes < CLOSE_MINUTES) state = "open";
    else if (minutes >= PRE_MARKET_MINUTES && minutes < OPEN_MINUTES) state = "pre_market";
    else if (minutes >= CLOSE_MINUTES && minutes < AFTER_HOURS_MINUTES) state = "after_hours";
  }

  const labels: Record<MarketSessionState, string> = {
    open: "Market open",
    pre_market: "Pre-market",
    after_hours: "After hours",
    closed: "Market closed",
  };

  return {
    state,
    label: labels[state],
    isOpen: state === "open",
    nextChangeAt: null,
  };
}
