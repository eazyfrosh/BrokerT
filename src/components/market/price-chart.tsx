"use client";

import * as React from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import type { Candle, ChartStyle, IndicatorKey } from "@/lib/market/types";
import { ema, macd, rsi, sma } from "@/lib/market/indicators";
import { cn } from "@/lib/utils";

interface PriceChartProps {
  candles: Candle[];
  style?: ChartStyle;
  indicators?: IndicatorKey[];
  height?: number;
  /** Colour the area/line by whether the series ended up or down. */
  colorByDirection?: boolean;
  showTimeScale?: boolean;
  showPriceScale?: boolean;
  className?: string;
}

/** Reads a CSS custom property into a concrete colour the chart can use. */
function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Professional price chart built on lightweight-charts.
 *
 * Handles line / area / candlestick styles, an optional volume pane and the
 * SMA, EMA, RSI and MACD overlays. Redraws on theme change so the grid and
 * crosshair stay legible in both palettes.
 */
export function PriceChart({
  candles,
  style = "area",
  indicators = [],
  height = 360,
  colorByDirection = true,
  showTimeScale = true,
  showPriceScale = true,
  className,
}: PriceChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const { resolvedTheme } = useTheme();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => setReady(true), []);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || !ready || candles.length === 0) return;

    const isDark = resolvedTheme === "dark";
    const text = cssVar("--muted-foreground", isDark ? "#9aa0aa" : "#6b7280");
    const grid = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,17,21,0.06)";
    const up = cssVar("--gain", "#16a34a");
    const down = cssVar("--loss", "#dc2626");
    const accent = cssVar("--primary", "#4f46e5");

    const rising = candles.length > 1 && candles[candles.length - 1].close >= candles[0].close;
    const seriesColor = colorByDirection ? (rising ? up : down) : accent;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: text,
        fontFamily: getComputedStyle(document.body).fontFamily,
        attributionLogo: false,
      },
      width: container.clientWidth,
      height,
      grid: {
        vertLines: { color: grid },
        horzLines: { color: grid },
      },
      rightPriceScale: {
        visible: showPriceScale,
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: indicators.includes("volume") ? 0.28 : 0.08 },
      },
      timeScale: {
        visible: showTimeScale,
        borderVisible: false,
        timeVisible: candles.length > 1 && candles[1].time - candles[0].time < 86_400,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: text, width: 1, style: 3, labelBackgroundColor: accent },
        horzLine: { color: text, width: 1, style: 3, labelBackgroundColor: accent },
      },
      handleScale: { axisPressedMouseMove: false },
      localization: {
        priceFormatter: (price: number) =>
          price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      },
    });
    chartRef.current = chart;

    // ---- Price series -------------------------------------------------
    let priceSeries: ISeriesApi<"Area" | "Line" | "Candlestick">;
    if (style === "candlestick") {
      priceSeries = chart.addSeries(CandlestickSeries, {
        upColor: up,
        downColor: down,
        borderUpColor: up,
        borderDownColor: down,
        wickUpColor: up,
        wickDownColor: down,
      });
      priceSeries.setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );
    } else if (style === "line") {
      priceSeries = chart.addSeries(LineSeries, { color: seriesColor, lineWidth: 2 });
      priceSeries.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
    } else {
      priceSeries = chart.addSeries(AreaSeries, {
        lineColor: seriesColor,
        topColor: `color-mix(in oklch, ${seriesColor} 28%, transparent)`,
        bottomColor: `color-mix(in oklch, ${seriesColor} 0%, transparent)`,
        lineWidth: 2,
      });
      priceSeries.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
    }

    // ---- Volume -------------------------------------------------------
    if (indicators.includes("volume")) {
      const volume = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.78, bottom: 0 },
        borderVisible: false,
      });
      volume.setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volume,
          color: c.close >= c.open
            ? `color-mix(in oklch, ${up} 35%, transparent)`
            : `color-mix(in oklch, ${down} 35%, transparent)`,
        })),
      );
    }

    // ---- Overlays -----------------------------------------------------
    if (indicators.includes("sma")) {
      const line = chart.addSeries(LineSeries, {
        color: cssVar("--chart-3", "#f59e0b"),
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      line.setData(sma(candles, 20).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    }
    if (indicators.includes("ema")) {
      const line = chart.addSeries(LineSeries, {
        color: cssVar("--chart-5", "#0ea5e9"),
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      line.setData(ema(candles, 50).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    }

    // RSI and MACD live on their own scale so they never distort the price axis.
    if (indicators.includes("rsi")) {
      const line = chart.addSeries(LineSeries, {
        color: cssVar("--chart-6", "#a855f7"),
        lineWidth: 1,
        priceScaleId: "oscillator",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      chart.priceScale("oscillator").applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
        borderVisible: false,
      });
      line.setData(rsi(candles, 14).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    }
    if (indicators.includes("macd")) {
      const result = macd(candles);
      const macdLine = chart.addSeries(LineSeries, {
        color: accent,
        lineWidth: 1,
        priceScaleId: "macd",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const signalLine = chart.addSeries(LineSeries, {
        color: cssVar("--chart-3", "#f59e0b"),
        lineWidth: 1,
        priceScaleId: "macd",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      chart.priceScale("macd").applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
        borderVisible: false,
      });
      macdLine.setData(result.macd.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      signalLine.setData(result.signal.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    }

    chart.timeScale().fitContent();

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) chart.applyOptions({ width });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, style, indicators, height, resolvedTheme, colorByDirection, showTimeScale, showPriceScale, ready]);

  return (
    <div
      ref={containerRef}
      className={cn("w-full", className)}
      style={{ height }}
      role="img"
      aria-label="Price chart"
    />
  );
}
