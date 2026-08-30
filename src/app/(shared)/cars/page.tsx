import type { Metadata } from "next";
import Link from "next/link";
import { Car, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { VehicleCard } from "@/components/cars/vehicle-card";
import { listVehicles } from "@/lib/services/vehicles";
import { getSessionContext } from "@/lib/auth";
import { APP } from "@/lib/config";

export const metadata: Metadata = {
  title: "Vehicle marketplace",
  description:
    "Configure a vehicle in BrokerT's independent demo marketplace. Order requests are simulated and are not connected to any manufacturer or dealer.",
};
export const dynamic = "force-dynamic";

export default async function CarsPage() {
  const [vehicles, session] = await Promise.all([listVehicles(), getSessionContext()]);
  const inApp = Boolean(session);

  return (
    <div className={inApp ? "space-y-6" : "mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8"}>
      <PageHeader
        title="Vehicle marketplace"
        description="Browse models, build a configuration and submit a simulated order request."
        actions={
          session && (
            <Button asChild variant="outline">
              <Link href="/car-orders">
                <ClipboardList /> My order requests
              </Link>
            </Button>
          )
        }
      />

      <Alert variant="warning">
        <Car />
        <AlertTitle>Independent demo marketplace</AlertTitle>
        <AlertDescription>
          <p>
            This section is a simulated vehicle-ordering experience. Configurations and prices are
            illustrative, no payment is taken, no vehicle is reserved, and nothing here is connected to
            any manufacturer inventory, order system or authorised dealer.
          </p>
          <p className="mt-2">{APP.trademarkNotice}</p>
        </AlertDescription>
      </Alert>

      <SetupNotice what="the vehicle catalogue" />

      {vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No vehicles listed"
          description="The vehicle catalogue is empty. Run the seed migration to populate it."
        />
      ) : (
        <section aria-label="Vehicles" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </section>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Specifications shown are illustrative figures for this demo marketplace and should not be relied
        on as manufacturer specifications. Vehicle illustrations are stylised and are not photographs of
        any actual vehicle.
      </p>
    </div>
  );
}
