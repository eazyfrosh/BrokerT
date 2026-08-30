import { displayName } from "@/lib/auth";
import type { Profile } from "@/types/database";

function timeOfDay(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Greeting({ profile, subtitle }: { profile: Profile; subtitle?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold">
        {timeOfDay()}, {displayName(profile)}
      </p>
      {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
