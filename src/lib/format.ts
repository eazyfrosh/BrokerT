/** Centralised formatting so every surface renders financial data identically. */

const currencyCache = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string, minimumFractionDigits: number, maximumFractionDigits: number) {
  const key = `${currency}:${minimumFractionDigits}:${maximumFractionDigits}`;
  let fmt = currencyCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
    });
    currencyCache.set(key, fmt);
  }
  return fmt;
}

export function formatCurrency(
  value: number | null | undefined,
  options: { currency?: string; decimals?: number; signed?: boolean } = {},
): string {
  const { currency = "USD", decimals = 2, signed = false } = options;
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const formatted = currencyFormatter(currency, decimals, decimals).format(Math.abs(value));
  if (signed) return `${value < 0 ? "−" : "+"}${formatted}`;
  return value < 0 ? `−${formatted}` : formatted;
}

/** Compact currency for dense cards: $1.2K, $3.4M, $1.1B. */
export function formatCompactCurrency(value: number | null | undefined, currency = "USD"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const decimals = Number.isInteger(value) ? 0 : 6;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(value);
}

export function formatPercent(
  value: number | null | undefined,
  options: { decimals?: number; signed?: boolean } = {},
): string {
  const { decimals = 2, signed = true } = options;
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const body = `${Math.abs(value).toFixed(decimals)}%`;
  if (signed) return `${value < 0 ? "−" : "+"}${body}`;
  return value < 0 ? `−${body}` : body;
}

export function formatDate(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatTime(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { timeStyle: "medium" }).format(date);
}

export function formatRelativeTime(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = date.getTime() - Date.now();
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unit);
  }
  return rtf.format(Math.round(diffMs / 1000), "second");
}

export function initialsOf(firstName?: string | null, lastName?: string | null, fallback = "?"): string {
  const a = firstName?.trim()?.[0] ?? "";
  const b = lastName?.trim()?.[0] ?? "";
  const combined = `${a}${b}`.toUpperCase();
  return combined || fallback;
}

/** "partially_filled" -> "Partially Filled" */
export function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
