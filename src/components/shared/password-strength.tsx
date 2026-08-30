"use client";

import { cn } from "@/lib/utils";

interface Check {
  label: string;
  passed: boolean;
}

/** Mirrors the rules in `passwordSchema` so the meter never disagrees with validation. */
export function scorePassword(value: string): { score: number; checks: Check[] } {
  const checks: Check[] = [
    { label: "At least 10 characters", passed: value.length >= 10 },
    { label: "An uppercase letter", passed: /[A-Z]/.test(value) },
    { label: "A lowercase letter", passed: /[a-z]/.test(value) },
    { label: "A number", passed: /[0-9]/.test(value) },
    { label: "A symbol", passed: /[^A-Za-z0-9]/.test(value) },
  ];
  return { score: checks.filter((c) => c.passed).length, checks };
}

const LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong"];
const TONES = ["bg-destructive", "bg-destructive", "bg-warning", "bg-chart-3", "bg-success"];

export function PasswordStrength({ value, className }: { value: string; className?: string }) {
  const { score, checks } = scorePassword(value);
  if (!value) return null;

  const index = Math.max(score - 1, 0);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" role="img" aria-label={`Password strength: ${LABELS[index]}`}>
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={cn("h-1 flex-1 rounded-full", i < score ? TONES[index] : "bg-muted")}
            />
          ))}
        </div>
        <span className="w-16 shrink-0 text-right text-xs font-medium text-muted-foreground">
          {LABELS[index]}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {checks.map((check) => (
          <li
            key={check.label}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              check.passed ? "text-success" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                check.passed ? "bg-success" : "bg-muted-foreground/40",
              )}
              aria-hidden
            />
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
