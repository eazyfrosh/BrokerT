"use client";

import * as React from "react";
import { AreaChart, BarChart3, CandlestickChart, LineChart, Loader2 } from "lucide-react";
import { PriceChart } from "./price-chart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TIMEFRAME_ORDER } from "@/lib/market/timeframes";
import type { Candle, ChartStyle, IndicatorKey, MarketSeries, Timeframe } from "@/lib/market/types";

const STYLES: { value: ChartStyle; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "line", label: "Line", icon: LineChart },
  { value: "area", label: "Area", icon: AreaChart },
  { value: "candlestick", label: "Candlestick", icon: CandlestickChart },
];

const INDICATORS: { value: IndicatorKey; label: string; description: string }[] = [
  { value: "volume", label: "Volume", description: "Traded volume histogram" },
  { value: "sma", label: "SMA 20", description: "20-period simple moving average" },
  { value: "ema", label: "EMA 50", description: "50-period exponential moving average" },
  { value: "rsi", label: "RSI 14", description: "14-period relative strength index" },
  { value: "macd", label: "MACD", description: "Moving average convergence divergence" },
];

/** Indicator swatches mirror the colours PriceChart draws them in. */
const INDICATOR_SWATCH: Partial<Record<IndicatorKey, string>> = {
  sma: "var(--chart-2)",
  ema: "var(--chart-4)",
  rsi: "var(--chart-5)",
  macd: "var(--chart-1)",
};

export function MarketTerminal({
  symbol,
  initialSeries,
  height = 420,
}: {
  symbol: string;
  initialSeries: MarketSeries;
  height?: number;
}) {
  const [timeframe, setTimeframe] = React.useState<Timeframe>(initialSeries.timeframe);
  const [style, setStyle] = React.useState<ChartStyle>("area");
  const [indicators, setIndicators] = React.useState<IndicatorKey[]>(["volume"]);
  const [candles, setCandles] = React.useState<Candle[]>(initialSeries.candles);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Series for the initially rendered timeframe comes from the server, so the
  // first paint needs no fetch.
  const cache = React.useRef(new Map<Timeframe, Candle[]>([[initialSeries.timeframe, initialSeries.candles]]));

  React.useEffect(() => {
    const cached = cache.current.get(timeframe);
    if (cached) {
      setCandles(cached);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const response = await fetch(
          `/api/market/series?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) throw new Error(String(response.status));
        const payload = (await response.json()) as { series: MarketSeries };
        cache.current.set(timeframe, payload.series.candles);
        setCandles(payload.series.candles);
      } catch (cause) {
        if ((cause as Error).name !== "AbortError") {
          setError("We could not load that timeframe. Try again.");
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [timeframe, symbol]);

  function toggleIndicator(key: IndicatorKey) {
    setIndicators((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  const activeOverlays = indicators.filter((key) => key !== "volume");

  return (
    <div className="space-y-3">
      {/* Controls sit in one row above the chart. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Chart timeframe"
          className="no-scrollbar -mx-1 flex gap-0.5 overflow-x-auto rounded-lg bg-muted p-1"
        >
          {TIMEFRAME_ORDER.map((option) => (
            <button
              key={option}
              role="tab"
              type="button"
              aria-selected={timeframe === option}
              onClick={() => setTimeframe(option)}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                timeframe === option
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <div role="group" aria-label="Chart style" className="flex gap-0.5 rounded-lg bg-muted p-1">
          {STYLES.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={style === option.value}
                aria-label={option.label}
                title={option.label}
                onClick={() => setStyle(option.value)}
                className={cn(
                  "rounded-md px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  style === option.value
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 grid place-items-center rounded-lg bg-background/60 backdrop-blur-[1px]">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading chart" />
          </div>
        )}

        {error ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/25 bg-destructive/5 text-center"
            style={{ height }}
          >
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                cache.current.delete(timeframe);
                setTimeframe((current) => current);
                setError(null);
              }}
            >
              Retry
            </Button>
          </div>
        ) : candles.length === 0 ? (
          <div
            className="grid place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground"
            style={{ height }}
          >
            No price history for this timeframe.
          </div>
        ) : (
          <PriceChart
            candles={candles}
            style={style}
            indicators={indicators}
            height={height}
            colorByDirection={style !== "candlestick"}
          />
        )}
      </div>

      {/* Indicator toggles double as the legend for whatever is drawn. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Indicators</span>
        {INDICATORS.map((indicator) => {
          const active = indicators.includes(indicator.value);
          const swatch = INDICATOR_SWATCH[indicator.value];
          return (
            <button
              key={indicator.value}
              type="button"
              aria-pressed={active}
              title={indicator.description}
              onClick={() => toggleIndicator(indicator.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {swatch && active && (
                <span className="size-2 rounded-[2px]" style={{ backgroundColor: swatch }} aria-hidden />
              )}
              {indicator.value === "volume" && active && <BarChart3 className="size-3" aria-hidden />}
              {indicator.label}
            </button>
          );
        })}
      </div>

      {activeOverlays.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Oscillators (RSI, MACD) are drawn on their own scale beneath the price so they do not distort
          the price axis.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="warning">Simulated</Badge>
        <p className="text-xs text-muted-foreground">
          Prices are generated by the demo market engine and are not real-time market prices.
        </p>
      </div>
    </div>
  );
}
