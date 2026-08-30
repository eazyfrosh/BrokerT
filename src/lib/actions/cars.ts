"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth";
import { carOrderSchema, uuidSchema } from "@/lib/validation/schemas";
import { publicEnv } from "@/lib/config";
import { sendEmail, carOrderEmail } from "@/lib/email";
import { formatCurrency } from "@/lib/format";
import { round } from "@/lib/utils";
import { ok, fail, fromZodError, fromDatabaseError, type ActionResult } from "./result";
import type { CarOrder, VehicleOption } from "@/types/database";

export interface CarOrderReceipt {
  id: string;
  reference: string;
  totalPrice: number;
  modelName: string;
  estimatedDelivery: string | null;
}

/**
 * Records a vehicle order request.
 *
 * The total is priced on the server from the stored option rows — a submitted
 * price is never trusted — and the request is recorded through
 * `create_car_order()`. No payment is taken and no vehicle is reserved.
 */
export async function submitCarOrderAction(input: unknown): Promise<ActionResult<CarOrderReceipt>> {
  const parsed = carOrderSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const session = await getSessionContext();
  if (!session) return fail("Please sign in to submit an order request.");
  if (session.profile.account_status !== "active") {
    return fail("Your account is not active, so order requests cannot be submitted.");
  }

  const data = parsed.data;

  const { data: vehicle } = await session.supabase
    .from("vehicles")
    .select("id, model_name, base_price, is_available")
    .eq("id", data.vehicleId)
    .maybeSingle<{ id: string; model_name: string; base_price: number; is_available: boolean }>();

  if (!vehicle) return fail("That vehicle could not be found.");
  if (!vehicle.is_available) return fail("That vehicle is not currently available to configure.");

  const { data: options } = await session.supabase
    .from("vehicle_options")
    .select("*")
    .eq("vehicle_id", vehicle.id)
    .returns<VehicleOption[]>();

  const catalogue = options ?? [];
  const find = (kind: VehicleOption["kind"], code: string) =>
    catalogue.find((option) => option.kind === kind && option.code === code);

  const trim = find("trim", data.trim);
  const exterior = find("exterior", data.exterior);
  const interior = find("interior", data.interior);
  const wheels = find("wheels", data.wheels);

  if (!trim || !exterior || !interior || !wheels) {
    return fail("That configuration is not valid for this vehicle.");
  }

  const extras = data.options
    .map((code) => find("option", code))
    .filter((option): option is VehicleOption => Boolean(option));

  if (extras.length !== data.options.length) {
    return fail("One or more selected options are not available for this vehicle.");
  }

  const total = round(
    Number(vehicle.base_price) +
      Number(trim.price_delta) +
      Number(exterior.price_delta) +
      Number(interior.price_delta) +
      Number(wheels.price_delta) +
      extras.reduce((sum, option) => sum + Number(option.price_delta), 0),
    2,
  );

  const summary = [trim.name, exterior.name, interior.name, wheels.name, ...extras.map((o) => o.name)].join(
    " · ",
  );

  const { data: created, error } = await session.supabase.rpc("create_car_order", {
    p_vehicle_id: vehicle.id,
    p_configuration: {
      trim: trim.code,
      exterior: exterior.code,
      interior: interior.code,
      wheels: wheels.code,
      options: extras.map((option) => option.code),
    },
    p_configuration_summary: summary,
    p_total_price: total,
    p_delivery: {
      full_name: data.fullName,
      email: data.email,
      phone: data.phone,
      address_line1: data.addressLine1,
      address_line2: data.addressLine2 || null,
      city: data.city,
      region: data.region,
      postal_code: data.postalCode,
      country: data.country,
    },
  });

  if (error) return fromDatabaseError(error, "We could not record that order request.");

  const order = created as unknown as CarOrder | null;
  if (!order) return fail("We could not record that order request.");

  await sendEmail(
    carOrderEmail(
      session.profile.email,
      { reference: order.reference, model: vehicle.model_name, total: formatCurrency(total) },
      publicEnv.appUrl,
    ),
  ).catch(() => undefined);

  revalidatePath("/car-orders");
  revalidatePath("/dashboard");

  return ok<CarOrderReceipt>({
    id: order.id,
    reference: order.reference,
    totalPrice: total,
    modelName: vehicle.model_name,
    estimatedDelivery: order.estimated_delivery,
  });
}

/** Customers may withdraw a request that has not yet been confirmed. */
export async function cancelCarOrderAction(id: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return fail("That order could not be found.");

  const session = await getSessionContext();
  if (!session) return fail("Please sign in to continue.");

  // RLS restricts this update to the caller's own row and to statuses that are
  // still withdrawable; a trigger blocks every field except the status.
  const { error, data } = await session.supabase
    .from("car_orders")
    .update({ status: "cancelled" })
    .eq("id", parsed.data)
    .select("id")
    .maybeSingle();

  if (error) return fromDatabaseError(error, "We could not cancel that order request.");
  if (!data) return fail("That order request can no longer be cancelled.");

  revalidatePath("/car-orders");
  revalidatePath(`/car-orders/${parsed.data}`);
  return ok(undefined, "Order request cancelled.");
}
