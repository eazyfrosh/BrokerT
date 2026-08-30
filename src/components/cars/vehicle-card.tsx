import Link from "next/link";
import { Gauge, Route, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VehicleVisual, variantForSlug } from "./vehicle-visual";
import { formatCurrency } from "@/lib/format";
import type { Vehicle } from "@/types/database";

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="bg-muted/50 px-4 pt-4 text-foreground">
        <VehicleVisual variant={variantForSlug(vehicle.slug)} className="max-h-40" />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold tracking-tight">{vehicle.model_name}</h3>
          {!vehicle.is_available && <Badge variant="muted">Unavailable</Badge>}
        </div>
        {vehicle.tagline && (
          <p className="mt-1 text-sm text-muted-foreground">{vehicle.tagline}</p>
        )}

        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
          <div>
            <dt className="flex items-center gap-1 text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
              <Route className="size-3" aria-hidden /> Range
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular">{vehicle.range_miles} mi</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
              <Gauge className="size-3" aria-hidden /> 0–60
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular">{vehicle.acceleration_0_60}s</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
              <Users className="size-3" aria-hidden /> Seats
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular">{vehicle.seating}</dd>
          </div>
        </dl>

        <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-4">
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">From</p>
            <p className="text-lg font-semibold tabular">
              {formatCurrency(Number(vehicle.base_price), { decimals: 0 })}
            </p>
          </div>
          <Button asChild size="sm" disabled={!vehicle.is_available}>
            <Link href={`/cars/${vehicle.slug}`}>Configure</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
