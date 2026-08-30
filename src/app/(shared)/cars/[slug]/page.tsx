import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gauge, Route, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/page-header";
import { VehicleConfigurator } from "@/components/cars/vehicle-configurator";
import { getVehicleBySlug, groupOptions } from "@/lib/services/vehicles";
import { getSessionContext, displayName } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { APP } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) return { title: "Vehicle" };
  return {
    title: `Configure the ${vehicle.model_name}`,
    description: vehicle.tagline ?? undefined,
  };
}

export default async function VehicleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [vehicle, session] = await Promise.all([getVehicleBySlug(slug), getSessionContext()]);
  if (!vehicle) notFound();

  const groups = groupOptions(vehicle.vehicle_options ?? []);
  const inApp = Boolean(session);

  const specs = [
    { label: "Range", value: `${vehicle.range_miles} mi`, icon: Route },
    { label: "0–60 mph", value: `${vehicle.acceleration_0_60}s`, icon: Gauge },
    { label: "Top speed", value: `${vehicle.top_speed_mph} mph`, icon: Zap },
    { label: "Seating", value: String(vehicle.seating), icon: Users },
  ];

  return (
    <div className={inApp ? "space-y-5" : "mx-auto w-full max-w-7xl space-y-5 px-4 py-8 sm:px-6 lg:px-8"}>
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/cars">
          <ArrowLeft /> All vehicles
        </Link>
      </Button>

      <PageHeader
        title={vehicle.model_name}
        description={vehicle.tagline ?? undefined}
      >
        <p className="pt-2 text-sm text-muted-foreground">
          From{" "}
          <span className="font-semibold tabular text-foreground">
            {formatCurrency(Number(vehicle.base_price), { decimals: 0 })}
          </span>{" "}
          · {vehicle.drive_type}
        </p>
      </PageHeader>

      <Alert variant="warning">
        <AlertTitle>Simulated order request</AlertTitle>
        <AlertDescription>
          Submitting this configuration records a request against your BrokerT account so you can follow
          the flow end to end. It is not a purchase, no payment is taken, no vehicle is reserved, and it
          is not sent to any manufacturer or dealer. {APP.trademarkNotice}
        </AlertDescription>
      </Alert>

      <section aria-label="Specifications" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {specs.map((spec) => {
          const Icon = spec.icon;
          return (
            <Card key={spec.label} className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="size-4" aria-hidden />
                <span className="text-xs uppercase tracking-wide">{spec.label}</span>
              </div>
              <p className="mt-2 text-xl font-semibold tabular">{spec.value}</p>
            </Card>
          );
        })}
      </section>

      <VehicleConfigurator
        vehicle={vehicle}
        groups={groups}
        signedIn={Boolean(session)}
        accountActive={session?.profile.account_status === "active"}
        defaultDelivery={
          session
            ? {
                fullName: displayName(session.profile),
                email: session.profile.email,
                phone: session.profile.phone ?? "",
                country: session.profile.country ?? "",
              }
            : undefined
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {vehicle.description && (
          <Card>
            <CardHeader>
              <CardTitle>About the {vehicle.model_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{vehicle.description}</p>
            </CardContent>
          </Card>
        )}

        {vehicle.features.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Included features</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2">
                {vehicle.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
