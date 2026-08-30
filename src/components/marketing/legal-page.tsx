import { cn } from "@/lib/utils";

export interface LegalSection {
  heading: string;
  body: React.ReactNode;
}

/** Shared shell for the terms, privacy and risk-disclosure pages. */
export function LegalPage({
  title,
  intro,
  updated,
  sections,
  className,
}: {
  title: string;
  intro: React.ReactNode;
  updated: string;
  sections: LegalSection[];
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8", className)}>
      <header className="space-y-3 border-b border-border pb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <div className="text-[0.9375rem] leading-relaxed text-muted-foreground">{intro}</div>
        <p className="text-xs text-muted-foreground">Last updated {updated}</p>
      </header>

      <nav aria-label="On this page" className="border-b border-border py-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contents</p>
        <ol className="mt-3 space-y-1.5">
          {sections.map((section, index) => (
            <li key={section.heading}>
              <a
                href={`#section-${index + 1}`}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {index + 1}. {section.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="divide-y divide-border">
        {sections.map((section, index) => (
          <section key={section.heading} id={`section-${index + 1}`} className="scroll-mt-20 py-8">
            <h2 className="text-lg font-semibold tracking-tight">
              {index + 1}. {section.heading}
            </h2>
            <div className="mt-3 space-y-3 text-[0.9375rem] leading-relaxed text-muted-foreground [&_li]:leading-relaxed [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
              {section.body}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
