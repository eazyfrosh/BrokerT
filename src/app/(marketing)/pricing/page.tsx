import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Section, SectionHeading } from "@/components/marketing/section";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { RiskNotice } from "@/components/shared/demo-notices";
import { TRADING } from "@/lib/config";
import { formatCurrency, formatPercent } from "@/lib/format";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "What BrokerT charges. Demo accounts are free; the fee schedule below is what a live deployment would apply.",
};

const PLANS = [
  {
    name: "Demo",
    price: "Free",
    cadence: "",
    description: "The whole platform with simulated balances and simulated market data.",
    featured: true,
    cta: { label: "Open a demo account", href: "/register" },
    features: [
      ["Full trading terminal", true],
      ["All eight chart timeframes and five indicators", true],
      ["Portfolio, orders and transaction ledger", true],
      ["Investment strategies and allocations", true],
      ["Vehicle configurator and order requests", true],
      ["Simulated market data", true],
      ["Real market data", false],
      ["Real money funding", false],
    ] as const,
  },
  {
    name: "Standard",
    price: formatCurrency(0, { decimals: 0 }),
    cadence: "/month",
    description: "The commission schedule a live deployment would run on.",
    featured: false,
    cta: { label: "Not available yet", href: "/contact" },
    features: [
      ["Everything in Demo", true],
      ["Licensed real-time market data", true],
      ["Regulated payment provider for funding", true],
      ["Identity verification", true],
      ["Priority support", true],
      ["Available today", false],
    ] as const,
  },
];

const FEES: [string, string, string][] = [
  ["Account opening", formatCurrency(0, { decimals: 0 }), "No charge to open or maintain an account."],
  ["Monthly account fee", formatCurrency(0, { decimals: 0 }), "None."],
  ["Commission per order", formatPercent(TRADING.commissionRate * 100, { signed: false }), "Charged on the order's notional value."],
  ["Flat order fee", formatCurrency(TRADING.flatFee), "Applied per executed order."],
  [
    "Regulatory fee on sells",
    `${(TRADING.sellFeeRate * 100).toFixed(5)}%`,
    "Illustrative pass-through fee applied to sell proceeds only.",
  ],
  ["Deposits", formatCurrency(0, { decimals: 0 }), "No charge. Demo mode moves no real money."],
  ["Withdrawals", formatCurrency(0, { decimals: 0 }), "No charge. Demo mode moves no real money."],
  ["Strategy management fee", "0.45%–0.85%", "Varies by strategy; stated on each strategy page."],
  ["Strategy performance fee", "0%–15%", "Varies by strategy; stated on each strategy page."],
];

const FAQ = [
  {
    question: "Is the demo account really free?",
    answer:
      "Yes. Demo mode has no payment integration at all — there is no way to be charged, because nothing on the platform can take a payment. Balances are records inside the application.",
  },
  {
    question: "Why is the commission zero?",
    answer:
      "Because no order is routed anywhere. Demo orders execute against a simulated venue, so there is no cost to pass on. A live deployment would set a real schedule here before taking a single customer order.",
  },
  {
    question: "What is the regulatory fee on sells?",
    answer:
      "It is an illustrative pass-through modelled on the small fees applied to sell transactions in some markets. In demo mode it is simulated, like everything else, and it is shown on the order preview before you confirm.",
  },
  {
    question: "Do strategy fees come out of my balance?",
    answer:
      "Strategy management and performance fees are stated on each strategy page and are reflected in the position's value rather than charged separately. In demo mode those values are simulated.",
  },
];

export default function PricingPage() {
  return (
    <>
      <Section className="border-t-0">
        <SectionHeading
          eyebrow="Pricing"
          title="Free while it is a demo. Transparent when it is not."
          description="Demo accounts cost nothing because nothing on the platform can take a payment. The schedule below is what a live deployment would apply."
          align="center"
        />

        <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={plan.featured ? "relative border-primary/40 p-6" : "p-6"}
            >
              {plan.featured && (
                <Badge className="absolute -top-2.5 left-6">Available now</Badge>
              )}
              <h2 className="text-base font-semibold">{plan.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>

              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight tabular">{plan.price}</span>
                {plan.cadence && <span className="text-sm text-muted-foreground">{plan.cadence}</span>}
              </p>

              <ul className="mt-5 space-y-2.5">
                {plan.features.map(([label, included]) => (
                  <li key={label} className="flex items-start gap-2.5 text-sm">
                    {included ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    ) : (
                      <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" aria-hidden />
                    )}
                    <span className={included ? "" : "text-muted-foreground/70"}>{label}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className="mt-6 w-full"
                variant={plan.featured ? "default" : "outline"}
                disabled={!plan.featured}
              >
                <Link href={plan.cta.href}>
                  {plan.cta.label}
                  {plan.featured && <ArrowRight />}
                </Link>
              </Button>
            </Card>
          ))}
        </div>
      </Section>

      <Section className="bg-muted/25">
        <SectionHeading eyebrow="Fee schedule" title="Every charge, in one table" />
        <Card className="mt-8 overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <caption className="sr-only">BrokerT fee schedule</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Charge
                  </th>
                  <th scope="col" className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Amount
                  </th>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEES.map(([label, amount, note]) => (
                  <tr key={label} className="border-b border-border last:border-0">
                    <th scope="row" className="px-5 py-3 text-left font-medium">
                      {label}
                    </th>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular">{amount}</td>
                    <td className="px-5 py-3 text-muted-foreground">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <RiskNotice className="mt-5" detail="Fees reduce returns. Strategy fees are stated on each strategy page." />
      </Section>

      <Section>
        <SectionHeading eyebrow="FAQ" title="Questions about cost" align="center" />
        <div className="mx-auto mt-10 max-w-3xl">
          <FaqAccordion items={FAQ} />
        </div>
      </Section>
    </>
  );
}
