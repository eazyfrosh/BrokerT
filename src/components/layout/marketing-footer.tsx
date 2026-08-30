import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { TrademarkNotice } from "@/components/shared/demo-notices";
import { Separator } from "@/components/ui/separator";
import { APP, DEMO_MODE } from "@/lib/config";

const SECTIONS = [
  {
    title: "Platform",
    links: [
      { href: "/markets", label: "Markets" },
      { href: "/tesla", label: "TSLA overview" },
      { href: "/investments", label: "Investments" },
      { href: "/cars", label: "Vehicle marketplace" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/risk-disclosure", label: "Risk disclosure" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-muted/25">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_2fr]">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-sm text-sm text-muted-foreground">{APP.description}</p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">{section.title}</h2>
                <ul className="mt-3 space-y-2">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-8" />

        <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
          <TrademarkNotice />
          <p>
            <strong className="font-medium text-foreground">Not investment advice.</strong> {APP.riskNotice}{" "}
            Target returns shown anywhere on this site are illustrative projections and are not guaranteed.
            Market data may be delayed.
          </p>
          {DEMO_MODE && (
            <p>
              <strong className="font-medium text-foreground">Demo mode.</strong> {APP.demoNotice}
            </p>
          )}
          <p>
            {APP.legalName} is not a registered broker-dealer, investment adviser, bank or money
            transmitter, and is not licensed or insured. Nothing on this site is an offer to buy or sell any
            security.
          </p>
          <p className="pt-2">
            © {new Date().getFullYear()} {APP.legalName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
