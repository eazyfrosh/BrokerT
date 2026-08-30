import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight, Battery, Car, Cpu, Factory, Sun, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Section, SectionHeading, FeatureCard } from "@/components/marketing/section";
import { PriceTicker } from "@/components/market/price-ticker";
import { MarketStatusPill } from "@/components/market/market-status-pill";
import { QuoteStats } from "@/components/market/quote-stats";
import { PriceChart } from "@/components/market/price-chart";
import { SimulatedDataNotice, RiskAlert, TrademarkNotice } from "@/components/shared/demo-notices";
import { SetupNotice } from "@/components/shared/setup-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { getMarketOverview } from "@/lib/services/market";

export const metadata: Metadata = {
  title: "TSLA overview",
  description:
    "An overview of Tesla, Inc. as a listed instrument, with simulated market data. BrokerT is not affiliated with Tesla, Inc.",
};
export const dynamic = "force-dynamic";

const SEGMENTS = [
  {
    icon: Car,
    title: "Automotive",
    description:
      "Design, manufacture and direct sale of electric vehicles. Historically the largest contributor to revenue and the segment most sensitive to delivery volumes, pricing and manufacturing throughput.",
  },
  {
    icon: Battery,
    title: "Energy generation and storage",
    description:
      "Stationary battery systems for residential, commercial and grid-scale use, alongside solar generation products. A smaller revenue base with different demand drivers from the vehicle business.",
  },
  {
    icon: Cpu,
    title: "Software and services",
    description:
      "Driver-assistance software, connectivity, charging access and after-sales service. Recurring in character, and dependent on regulatory acceptance of assisted-driving features.",
  },
  {
    icon: Factory,
    title: "Manufacturing footprint",
    description:
      "Vertically integrated production across several regions. Capital intensity and utilisation strongly influence margins in any given period.",
  },
];

const FACTORS = [
  "Delivery volumes and the average selling price achieved across the vehicle range.",
  "Gross margin, which reflects manufacturing utilisation, input costs and discounting.",
  "Competitive intensity as established manufacturers expand electric line-ups.",
  "Regulatory treatment of assisted-driving software in each market.",
  "Interest rates and their effect on both vehicle financing demand and growth-equity valuations.",
  "Commodity prices for battery materials, and the stability of the supply chain behind them.",
];

export default async function TeslaPage() {
  const { asset, quote, series, status } = await getMarketOverview("1Y");

  return (
    <>
      <Section className="border-t-0">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div>
            <SectionHeading
              eyebrow="Instrument overview"
              title="Tesla, Inc. (TSLA)"
              description="What the company does, what moves the share price, and what to be careful about. This is information, not advice."
            />

            <div className="mt-6 space-y-4 text-[0.9375rem] leading-relaxed text-muted-foreground">
              <p>
                Tesla, Inc. designs, develops, manufactures and sells electric vehicles, and produces
                energy generation and storage systems. It is listed on NASDAQ and is one of the most
                heavily traded and most volatile large-capitalisation equities in the US market.
              </p>
              <p>
                A single-issuer position carries that issuer&apos;s full idiosyncratic risk. Concentrating
                a portfolio in one company means company-specific news — a delivery figure, a product
                decision, a regulatory ruling — moves the whole position with nothing to offset it.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/markets">
                  Open the market terminal <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/trade">
                  <ArrowLeftRight /> Trade TSLA
                </Link>
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle>{asset?.name ?? "Tesla, Inc."}</CardTitle>
                  <Badge variant="secondary" className="font-mono text-[0.6875rem]">TSLA</Badge>
                </div>
                <MarketStatusPill status={status} />
              </div>
              {quote ? (
                <PriceTicker initialQuote={quote} size="md" />
              ) : (
                <p className="text-sm text-muted-foreground">Market data unavailable</p>
              )}
            </CardHeader>

            <CardContent className="space-y-4 p-0">
              {series && series.candles.length > 0 ? (
                <PriceChart candles={series.candles} style="area" height={200} showPriceScale={false} />
              ) : (
                <div className="px-5">
                  <SetupNotice what="market data" />
                  {!quote && <EmptyState title="No chart data" compact className="mt-3" />}
                </div>
              )}

              {quote && (
                <div className="space-y-3 border-t border-border p-5">
                  <QuoteStats quote={quote} />
                  <SimulatedDataNotice />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section className="bg-muted/25">
        <SectionHeading eyebrow="Business" title="What the company actually sells" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {SEGMENTS.map((segment) => (
            <FeatureCard
              key={segment.title}
              icon={segment.icon}
              title={segment.title}
              description={segment.description}
            />
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              eyebrow="Drivers"
              title="What tends to move the price"
              description="Not a forecast — a list of the variables market participants watch."
            />
            <ul className="mt-6 space-y-3">
              {FACTORS.map((factor) => (
                <li key={factor} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                  <TrendingUp className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {factor}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-5">
            <SectionHeading eyebrow="Risk" title="Before you concentrate a portfolio" />
            <RiskAlert>
              A position in a single equity has no diversification benefit and no downside protection.
              TSLA has historically experienced drawdowns exceeding 50% from peak to trough. Only commit
              capital you can afford to lose, and consider how a single-issuer position sits alongside
              everything else you hold.
            </RiskAlert>
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <Sun className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
                <div>
                  <p className="text-sm font-medium">This page is not investment advice</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    Nothing here is a recommendation to buy, sell or hold any security, and it does not
                    take account of your circumstances or objectives. If you are unsure, seek independent
                    advice from someone authorised to give it.
                  </p>
                </div>
              </div>
            </Card>
            <TrademarkNotice />
          </div>
        </div>
      </Section>
    </>
  );
}
