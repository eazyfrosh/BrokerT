import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CandlestickChart,
  Fingerprint,
  Gauge,
  KeyRound,
  LineChart,
  ListChecks,
  PieChart,
  Server,
  Smartphone,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Section, SectionHeading, FeatureCard } from "@/components/marketing/section";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { PriceTicker } from "@/components/market/price-ticker";
import { MarketStatusPill } from "@/components/market/market-status-pill";
import { QuoteStats } from "@/components/market/quote-stats";
import { PriceChart } from "@/components/market/price-chart";
import { DemoBadge, SimulatedDataNotice, RiskNotice } from "@/components/shared/demo-notices";
import { SetupNotice } from "@/components/shared/setup-notice";
import { RiskMeter } from "@/components/shared/risk-meter";
import { EmptyState } from "@/components/shared/empty-state";
import { getMarketOverview } from "@/lib/services/market";
import { listOpenInvestments } from "@/lib/services/investments";
import { formatCurrency, formatPercent } from "@/lib/format";
import { APP } from "@/lib/config";

export const dynamic = "force-dynamic";

const FAQ = [
  {
    question: "Is BrokerT affiliated with Tesla, Inc.?",
    answer:
      "No. BrokerT is an independent platform focused on Tesla-related market data and investment tooling. It is not owned, operated, sponsored or endorsed by Tesla, Inc., and it is not an authorised Tesla dealer.",
  },
  {
    question: "Is the market data real?",
    answer:
      "Not in demo mode. The platform ships with a simulated market engine so it is fully usable without a licensed data feed. Every price is labelled as simulated. The market-data layer is a swappable interface — connecting a licensed provider such as Polygon, Finnhub or Twelve Data replaces the simulation without touching the rest of the application.",
  },
  {
    question: "Can I deposit or withdraw real money?",
    answer:
      "No. Demo mode has no connection to any payment rail, and the deposit and withdrawal functions refuse to run when demo mode is switched off. Real money movement requires integrating a regulated payment provider and completing the compliance work that goes with it.",
  },
  {
    question: "Are the target returns guaranteed?",
    answer:
      "No. Every target return shown on the platform is an illustrative projection based on simulated data. Projections are not promises. The value of investments can fall as well as rise and you may get back less than you put in.",
  },
  {
    question: "Can I really order a vehicle here?",
    answer:
      "The vehicle section is an independent demo marketplace. Submitting a configuration records an order request in your account so you can see the full flow end to end; it is not a purchase, it does not reserve a vehicle, and it is not connected to any manufacturer or dealer system.",
  },
  {
    question: "How is my data protected?",
    answer:
      "Authorisation is enforced in the database with PostgreSQL Row Level Security, not just in the interface. Every table is deny-by-default and scoped to your own user id, money movement happens only inside audited transactional functions, and administrative actions are written to an append-only audit log.",
  },
];

export default async function HomePage() {
  const [{ quote, series, status }, investments] = await Promise.all([
    getMarketOverview("6M"),
    listOpenInvestments(3),
  ]);

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_-10%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent)]"
        />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            <div className="max-w-xl">
              <div className="flex flex-wrap items-center gap-2">
                <DemoBadge label="Demo / simulated data" />
                <Badge variant="outline">Independent platform</Badge>
              </div>

              <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
                Invest in Tesla.
                <br />
                <span className="text-primary">Built for modern investors.</span>
              </h1>

              <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
                Follow TSLA market data on a professional-grade terminal, build and track a portfolio,
                place orders through a real matching engine, and explore thematic investment strategies —
                all in one account.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/register">
                    Start investing <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/markets">Explore markets</Link>
                </Button>
              </div>

              <div className="mt-8 rounded-xl border border-warning/30 bg-warning/8 p-4">
                <p className="text-sm font-medium">Demo / simulated market data</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {APP.demoNotice} BrokerT is not affiliated with Tesla, Inc.
                </p>
              </div>
            </div>

            {/* Live market card */}
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">Tesla, Inc.</h2>
                    <Badge variant="secondary" className="font-mono text-[0.6875rem]">TSLA</Badge>
                  </div>
                  {quote ? (
                    <PriceTicker initialQuote={quote} size="md" className="mt-2" />
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Market data unavailable</p>
                  )}
                </div>
                <MarketStatusPill status={status} />
              </div>

              <div className="px-1 pt-2">
                {series && series.candles.length > 0 ? (
                  <PriceChart
                    candles={series.candles}
                    style="area"
                    height={210}
                    showPriceScale={false}
                    showTimeScale={false}
                  />
                ) : (
                  <div className="px-4 py-10">
                    <SetupNotice what="market data" />
                    {!quote && <EmptyState title="No chart data" compact className="mt-3" />}
                  </div>
                )}
              </div>

              {quote && (
                <div className="space-y-3 border-t border-border p-5">
                  <QuoteStats quote={quote} />
                  <SimulatedDataNotice />
                </div>
              )}
            </Card>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Why BrokerT                                                      */}
      {/* ---------------------------------------------------------------- */}
      <Section>
        <SectionHeading
          eyebrow="Why BrokerT"
          title="Everything a focused investor needs, in one account"
          description="A single instrument, covered properly — rather than a shallow view of ten thousand tickers."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={CandlestickChart}
            title="Professional charting"
            description="Line, area and candlestick views across eight timeframes, with volume, moving averages, EMA, RSI and MACD."
          />
          <FeatureCard
            icon={ListChecks}
            title="Real order lifecycle"
            description="Market, limit, stop and stop-limit orders, with preview, confirmation, resting orders and cancellation — all backed by the database."
          />
          <FeatureCard
            icon={PieChart}
            title="Derived portfolio"
            description="Every value on your portfolio page is calculated from your actual holdings and the current quote. Nothing is hardcoded."
          />
          <FeatureCard
            icon={Wallet}
            title="Transparent ledger"
            description="Each trade, fee, allocation and cash movement is written to an auditable transaction record with its own reference."
          />
          <FeatureCard
            icon={Bell}
            title="Notifications that persist"
            description="Fills, order updates, allocation confirmations and security alerts are stored against your account, not just flashed on screen."
          />
          <FeatureCard
            icon={Gauge}
            title="Built to be replaced"
            description="The market-data layer is an interface. Point it at a licensed provider and the simulation disappears without a rewrite."
          />
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Portfolio + trading                                              */}
      {/* ---------------------------------------------------------------- */}
      <Section className="bg-muted/25">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              eyebrow="Portfolio management"
              title="Know exactly what you hold, and what it is doing"
              description="Total value, cost basis, today's move and lifetime return — recomputed from your holdings on every request."
            />
            <ul className="mt-6 space-y-3">
              {[
                "Holdings table with market value, day P/L, total P/L and return %",
                "Allocation breakdown across positions, strategies and cash",
                "Performance history across seven timeframes",
                "Sortable columns and a mobile layout that stays readable",
              ].map((item) => (
                <li key={item} className="flex gap-2.5 text-sm text-muted-foreground">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-7">
              <Link href="/portfolio">
                See the portfolio view <ArrowRight />
              </Link>
            </Button>
          </div>

          <div>
            <SectionHeading
              eyebrow="Trading tools"
              title="A terminal, not a toy"
              description="Market information on the left, chart in the centre, order ticket on the right — the layout traders already know."
            />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <FeatureCard
                icon={LineChart}
                title="Order preview"
                description="Estimated price, fees, total and resulting cash and position before anything is committed."
              />
              <FeatureCard
                icon={BarChart3}
                title="Server-side execution"
                description="Prices, buying power and position checks are resolved in the database, never trusted from the browser."
              />
            </div>
            <Button asChild variant="outline" className="mt-7">
              <Link href="/trade">
                Open the trading terminal <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Investments                                                      */}
      {/* ---------------------------------------------------------------- */}
      <Section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Investment opportunities"
            title="Thematic strategies with the risk written down"
            description="Every strategy states its objective, its risk level and what could go wrong — before it states a target."
          />
          <Button asChild variant="outline">
            <Link href="/investments">
              View all strategies <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="mt-10">
          {investments.length === 0 ? (
            <>
              <SetupNotice what="investment strategies" />
              {investments.length === 0 && (
                <EmptyState
                  className="mt-4"
                  title="No open strategies"
                  description="Investment products appear here once they are published."
                />
              )}
            </>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {investments.map((investment) => (
                <Card key={investment.id} className="flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant="secondary">{investment.category}</Badge>
                    <RiskMeter level={investment.risk_level} showLabel={false} />
                  </div>
                  <h3 className="mt-3.5 text-base font-semibold">{investment.name}</h3>
                  <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {investment.summary}
                  </p>
                  <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
                    <div>
                      <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Target</dt>
                      <dd className="mt-0.5 text-sm font-semibold tabular">
                        {formatPercent(investment.target_return_pct, { signed: false })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Term</dt>
                      <dd className="mt-0.5 text-sm font-semibold tabular">{investment.duration_months}m</dd>
                    </div>
                    <div>
                      <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">Minimum</dt>
                      <dd className="mt-0.5 text-sm font-semibold tabular">
                        {formatCurrency(investment.minimum_amount, { decimals: 0 })}
                      </dd>
                    </div>
                  </dl>
                  <Button asChild variant="outline" size="sm" className="mt-4">
                    <Link href={`/investments/${investment.slug}`}>Review strategy</Link>
                  </Button>
                </Card>
              ))}
            </div>
          )}
          <RiskNotice className="mt-5" detail="Target returns are illustrative projections, not guarantees." />
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Security + mobile                                                */}
      {/* ---------------------------------------------------------------- */}
      <Section className="bg-muted/25">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              eyebrow="Security"
              title="Authorisation where it actually counts"
              description="Hiding a page is not access control. BrokerT enforces every rule in the database."
            />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <FeatureCard
                icon={Server}
                title="Row Level Security"
                description="Every table is deny-by-default and scoped to your user id. One user can never read another's rows."
              />
              <FeatureCard
                icon={KeyRound}
                title="No client-side trust"
                description="Prices, balances and permissions are resolved server-side. The service-role key never reaches the browser."
              />
              <FeatureCard
                icon={Fingerprint}
                title="Session visibility"
                description="Review your login history and active sessions, and change your password with re-authentication."
              />
              <FeatureCard
                icon={ListChecks}
                title="Immutable audit log"
                description="Administrative actions are appended to a log that no administrator can edit or delete."
              />
            </div>
          </div>

          <div>
            <SectionHeading
              eyebrow="Mobile experience"
              title="The whole platform, on a phone"
              description="Not a cut-down view — the same data, laid out for a smaller screen."
            />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <FeatureCard
                icon={Smartphone}
                title="Bottom navigation"
                description="Home, portfolio, markets, trade and profile stay one tap away on small screens."
              />
              <FeatureCard
                icon={CandlestickChart}
                title="Charts that still work"
                description="Charts resize to the viewport and stay interactive rather than being replaced by a static image."
              />
            </div>
            <div className="mt-6 rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-medium">Dark, light and system themes</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Your preference is stored on your account and applied before the first paint, so there is no
                flash of the wrong theme.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* FAQ                                                              */}
      {/* ---------------------------------------------------------------- */}
      <Section>
        <SectionHeading eyebrow="FAQ" title="Questions worth asking first" align="center" />
        <div className="mx-auto mt-10 max-w-3xl">
          <FaqAccordion items={FAQ} />
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Still unsure?{" "}
            <Link href="/contact" className="font-medium text-primary hover:underline">
              Get in touch
            </Link>
            .
          </p>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Closing CTA                                                      */}
      {/* ---------------------------------------------------------------- */}
      <Section className="border-t border-border">
        <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center sm:px-12">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Open a demo account in under a minute
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground">
            No payment details, no real money, no obligation. Explore the full platform with simulated
            balances and simulated market data.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">
                Create your account <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/tesla">Read the TSLA overview</Link>
            </Button>
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {APP.riskNotice} {APP.trademarkNotice}
          </p>
        </div>
      </Section>
    </>
  );
}
