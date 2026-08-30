"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VehicleVisual, variantForSlug } from "./vehicle-visual";
import { submitCarOrderAction, type CarOrderReceipt } from "@/lib/actions/cars";
import { COUNTRIES } from "@/lib/countries";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn, round } from "@/lib/utils";
import type { Vehicle, VehicleOption, VehicleOptionKind } from "@/types/database";

const STEPS = [
  { id: "trim", label: "Trim" },
  { id: "exterior", label: "Paint" },
  { id: "interior", label: "Interior" },
  { id: "wheels", label: "Wheels" },
  { id: "option", label: "Options" },
  { id: "review", label: "Review" },
  { id: "delivery", label: "Delivery" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

interface DeliveryForm {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

const EMPTY_DELIVERY: DeliveryForm = {
  fullName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
};

export function VehicleConfigurator({
  vehicle,
  groups,
  signedIn,
  accountActive,
  defaultDelivery,
}: {
  vehicle: Vehicle;
  groups: Record<VehicleOptionKind, VehicleOption[]>;
  signedIn: boolean;
  accountActive: boolean;
  defaultDelivery?: Partial<DeliveryForm>;
}) {
  const router = useRouter();

  const pickDefault = React.useCallback(
    (kind: VehicleOptionKind) =>
      groups[kind].find((option) => option.is_default)?.code ?? groups[kind][0]?.code ?? "",
    [groups],
  );

  const [step, setStep] = React.useState<StepId>("trim");
  const [trim, setTrim] = React.useState(() => pickDefault("trim"));
  const [exterior, setExterior] = React.useState(() => pickDefault("exterior"));
  const [interior, setInterior] = React.useState(() => pickDefault("interior"));
  const [wheels, setWheels] = React.useState(() => pickDefault("wheels"));
  const [extras, setExtras] = React.useState<string[]>([]);
  const [delivery, setDelivery] = React.useState<DeliveryForm>({ ...EMPTY_DELIVERY, ...defaultDelivery });
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [receipt, setReceipt] = React.useState<CarOrderReceipt | null>(null);

  const selected = React.useMemo(() => {
    const find = (kind: VehicleOptionKind, code: string) =>
      groups[kind].find((option) => option.code === code) ?? null;
    return {
      trim: find("trim", trim),
      exterior: find("exterior", exterior),
      interior: find("interior", interior),
      wheels: find("wheels", wheels),
      extras: extras
        .map((code) => find("option", code))
        .filter((option): option is VehicleOption => Boolean(option)),
    };
  }, [groups, trim, exterior, interior, wheels, extras]);

  // Priced client-side for immediate feedback; the server prices it again from
  // the catalogue before recording anything.
  const total = React.useMemo(() => {
    const deltas =
      Number(selected.trim?.price_delta ?? 0) +
      Number(selected.exterior?.price_delta ?? 0) +
      Number(selected.interior?.price_delta ?? 0) +
      Number(selected.wheels?.price_delta ?? 0) +
      selected.extras.reduce((sum, option) => sum + Number(option.price_delta), 0);
    return round(Number(vehicle.base_price) + deltas, 2);
  }, [vehicle.base_price, selected]);

  const estimatedRange = React.useMemo(
    () =>
      Math.max(
        vehicle.range_miles +
          Number(selected.trim?.range_delta_miles ?? 0) +
          Number(selected.wheels?.range_delta_miles ?? 0),
        0,
      ),
    [vehicle.range_miles, selected],
  );

  const stepIndex = STEPS.findIndex((item) => item.id === step);

  function validateDelivery(): boolean {
    const errors: Record<string, string> = {};
    if (delivery.fullName.trim().length < 2) errors.fullName = "Enter the full name";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(delivery.email)) errors.email = "Enter a valid email";
    if (delivery.phone.trim().length < 7) errors.phone = "Enter a valid phone number";
    if (delivery.addressLine1.trim().length < 3) errors.addressLine1 = "Enter a street address";
    if (delivery.city.trim().length < 2) errors.city = "Enter a city";
    if (delivery.region.trim().length < 1) errors.region = "Enter a state or region";
    if (delivery.postalCode.trim().length < 2) errors.postalCode = "Enter a postal code";
    if (delivery.country.trim().length < 2) errors.country = "Select a country";
    if (!acknowledged) errors.acknowledge = "Acknowledge this is a simulated order request";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit() {
    if (!validateDelivery()) return;

    setSubmitting(true);
    setError(null);

    const result = await submitCarOrderAction({
      vehicleId: vehicle.id,
      trim,
      exterior,
      interior,
      wheels,
      options: extras,
      fullName: delivery.fullName,
      email: delivery.email,
      phone: delivery.phone,
      addressLine1: delivery.addressLine1,
      addressLine2: delivery.addressLine2,
      city: delivery.city,
      region: delivery.region,
      postalCode: delivery.postalCode,
      country: delivery.country,
      acknowledgeDemo: true,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      return;
    }

    setReceipt(result.data);
    router.refresh();
    toast.success("Order request recorded", { description: `Reference ${result.data.reference}` });
  }

  function OptionGrid({
    kind,
    value,
    onChange,
  }: {
    kind: VehicleOptionKind;
    value: string;
    onChange: (code: string) => void;
  }) {
    return (
      <div role="radiogroup" aria-label={kind} className="grid gap-2 sm:grid-cols-2">
        {groups[kind].map((option) => {
          const active = option.code === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.code)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary bg-primary/6" : "border-border hover:border-primary/40",
              )}
            >
              {option.swatch ? (
                <span
                  className="mt-0.5 size-6 shrink-0 rounded-full border border-border"
                  style={{ backgroundColor: option.swatch }}
                  aria-hidden
                />
              ) : (
                <span
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-input",
                  )}
                  aria-hidden
                >
                  {active && <Check className="size-3" strokeWidth={3} />}
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{option.name}</span>
                  <span className="shrink-0 text-sm tabular text-muted-foreground">
                    {Number(option.price_delta) === 0
                      ? "Included"
                      : `+${formatCurrency(Number(option.price_delta), { decimals: 0 })}`}
                  </span>
                </span>
                {option.description && (
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {option.description}
                  </span>
                )}
                {option.range_delta_miles !== 0 && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {option.range_delta_miles > 0 ? "+" : ""}
                    {option.range_delta_miles} mi range
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  function DeliveryField({
    name,
    label,
    type = "text",
    autoComplete,
    className,
  }: {
    name: keyof DeliveryForm;
    label: string;
    type?: string;
    autoComplete?: string;
    className?: string;
  }) {
    return (
      <div className={cn("space-y-1.5", className)}>
        <Label htmlFor={`delivery-${name}`}>{label}</Label>
        <Input
          id={`delivery-${name}`}
          type={type}
          autoComplete={autoComplete}
          value={delivery[name]}
          onChange={(event) => setDelivery((current) => ({ ...current, [name]: event.target.value }))}
          aria-invalid={Boolean(fieldErrors[name])}
        />
        {fieldErrors[name] && <p className="text-xs font-medium text-destructive">{fieldErrors[name]}</p>}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        {/* ----------------------------------------------------------- */}
        {/* Steps                                                        */}
        {/* ----------------------------------------------------------- */}
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-foreground">
            <VehicleVisual
              variant={variantForSlug(vehicle.slug)}
              bodyColor={selected.exterior?.swatch ?? "#4a4d52"}
              className="max-h-52"
            />
          </div>

          <ol className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1" aria-label="Configuration steps">
            {STEPS.map((item, index) => {
              const done = index < stepIndex;
              const active = item.id === step;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setStep(item.id)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : done
                          ? "border-border bg-card text-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {done ? (
                      <Check className="size-3" strokeWidth={3} aria-hidden />
                    ) : (
                      <span className="tabular">{index + 1}</span>
                    )}
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="rounded-xl border border-border bg-card p-5">
            {step === "trim" && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Choose a trim</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Trim sets the drivetrain, battery and performance envelope.
                  </p>
                </div>
                <OptionGrid kind="trim" value={trim} onChange={setTrim} />
              </section>
            )}

            {step === "exterior" && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Choose a paint colour</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The illustration above updates with your selection.
                  </p>
                </div>
                <OptionGrid kind="exterior" value={exterior} onChange={setExterior} />
              </section>
            )}

            {step === "interior" && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Choose an interior</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Seat and trim finish.</p>
                </div>
                <OptionGrid kind="interior" value={interior} onChange={setInterior} />
              </section>
            )}

            {step === "wheels" && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Choose wheels</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Larger wheels sharpen handling and reduce range.
                  </p>
                </div>
                <OptionGrid kind="wheels" value={wheels} onChange={setWheels} />
              </section>
            )}

            {step === "option" && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Add options</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Optional extras. Select any that apply.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {groups.option.map((option) => {
                    const active = extras.includes(option.code);
                    return (
                      <label
                        key={option.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
                          active ? "border-primary bg-primary/6" : "border-border hover:border-primary/40",
                        )}
                      >
                        <Checkbox
                          checked={active}
                          onCheckedChange={(value) =>
                            setExtras((current) =>
                              value === true
                                ? [...current, option.code]
                                : current.filter((code) => code !== option.code),
                            )
                          }
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{option.name}</span>
                            <span className="shrink-0 text-sm tabular text-muted-foreground">
                              +{formatCurrency(Number(option.price_delta), { decimals: 0 })}
                            </span>
                          </span>
                          {option.description && (
                            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                              {option.description}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            )}

            {step === "review" && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Review your configuration</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Check everything before entering delivery details.
                  </p>
                </div>
                <dl className="divide-y divide-border rounded-lg border border-border">
                  {[
                    ["Model", vehicle.model_name],
                    ["Trim", selected.trim?.name ?? "—"],
                    ["Paint", selected.exterior?.name ?? "—"],
                    ["Interior", selected.interior?.name ?? "—"],
                    ["Wheels", selected.wheels?.name ?? "—"],
                    ["Options", selected.extras.length ? selected.extras.map((o) => o.name).join(", ") : "None"],
                    ["Estimated range", `${estimatedRange} mi`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 px-3 py-2.5 text-sm">
                      <dt className="shrink-0 text-muted-foreground">{label}</dt>
                      <dd className="text-right font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {step === "delivery" && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Delivery details</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Where this request would be delivered if it were a real order.
                  </p>
                </div>

                {!signedIn ? (
                  <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">
                      Sign in to submit an order request. Your configuration is kept while you do.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <Link href={`/login?next=/cars/${vehicle.slug}`}>Sign in</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/register">Create an account</Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <DeliveryField name="fullName" label="Full name" autoComplete="name" className="sm:col-span-2" />
                      <DeliveryField name="email" label="Email" type="email" autoComplete="email" />
                      <DeliveryField name="phone" label="Phone" type="tel" autoComplete="tel" />
                      <DeliveryField
                        name="addressLine1"
                        label="Address"
                        autoComplete="address-line1"
                        className="sm:col-span-2"
                      />
                      <DeliveryField
                        name="addressLine2"
                        label="Address line 2 (optional)"
                        autoComplete="address-line2"
                        className="sm:col-span-2"
                      />
                      <DeliveryField name="city" label="City" autoComplete="address-level2" />
                      <DeliveryField name="region" label="State / region" autoComplete="address-level1" />
                      <DeliveryField name="postalCode" label="Postal code" autoComplete="postal-code" />

                      <div className="space-y-1.5">
                        <Label htmlFor="delivery-country">Country</Label>
                        <Select
                          value={delivery.country}
                          onValueChange={(value) => setDelivery((current) => ({ ...current, country: value }))}
                        >
                          <SelectTrigger id="delivery-country" aria-invalid={Boolean(fieldErrors.country)}>
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((country) => (
                              <SelectItem key={country} value={country}>
                                {country}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldErrors.country && (
                          <p className="text-xs font-medium text-destructive">{fieldErrors.country}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/8 p-3.5">
                      <Checkbox
                        id="acknowledge-demo"
                        checked={acknowledged}
                        onCheckedChange={(value) => setAcknowledged(value === true)}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor="acknowledge-demo"
                        className="text-sm font-normal leading-relaxed text-muted-foreground"
                      >
                        I understand this is a simulated order request in an independent demo marketplace.
                        It is not a purchase, it does not reserve a vehicle, no payment is taken, and it is
                        not connected to any manufacturer or dealer system.
                      </Label>
                    </div>
                    {fieldErrors.acknowledge && (
                      <p className="text-xs font-medium text-destructive">{fieldErrors.acknowledge}</p>
                    )}

                    {!accountActive && (
                      <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
                        Your account is not active, so order requests cannot be submitted.
                      </p>
                    )}

                    {error && (
                      <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-destructive">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                        {error}
                      </p>
                    )}
                  </>
                )}
              </section>
            )}

            {/* Step navigation */}
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
              <Button
                variant="outline"
                disabled={stepIndex === 0}
                onClick={() => setStep(STEPS[Math.max(stepIndex - 1, 0)].id)}
              >
                <ChevronLeft /> Back
              </Button>

              {step === "delivery" ? (
                <Button
                  loading={submitting}
                  disabled={!signedIn || !accountActive}
                  onClick={submit}
                >
                  Submit order request
                </Button>
              ) : (
                <Button onClick={() => setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)].id)}>
                  Continue <ChevronRight />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* Running summary                                              */}
        {/* ----------------------------------------------------------- */}
        <div>
          <div className="rounded-xl border border-border bg-card p-5 lg:sticky lg:top-20">
            <h2 className="text-sm font-semibold">Your configuration</h2>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{vehicle.model_name}</dt>
                <dd className="tabular">{formatCurrency(Number(vehicle.base_price), { decimals: 0 })}</dd>
              </div>
              {[selected.trim, selected.exterior, selected.interior, selected.wheels, ...selected.extras]
                .filter((option): option is VehicleOption => Boolean(option))
                .filter((option) => Number(option.price_delta) !== 0)
                .map((option) => (
                  <div key={option.id} className="flex justify-between gap-3">
                    <dt className="min-w-0 truncate text-muted-foreground">{option.name}</dt>
                    <dd className="shrink-0 tabular">
                      +{formatCurrency(Number(option.price_delta), { decimals: 0 })}
                    </dd>
                  </div>
                ))}
            </dl>

            <Separator className="my-4" />

            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted-foreground">Estimated total</span>
              <span className="text-xl font-semibold tabular">{formatCurrency(total, { decimals: 0 })}</span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Estimated range</dt>
                <dd className="mt-0.5 font-semibold tabular">{estimatedRange} mi</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">0–60 mph</dt>
                <dd className="mt-0.5 font-semibold tabular">{vehicle.acceleration_0_60}s</dd>
              </div>
            </dl>

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/8 p-3">
              <Badge variant="warning" className="shrink-0">Demo</Badge>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Independent demo marketplace. Prices are illustrative, no payment is taken and no vehicle
                is reserved.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt ------------------------------------------------------ */}
      <Dialog open={Boolean(receipt)} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent>
          {receipt && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-full bg-success/12 text-success">
                    <CheckCircle2 className="size-5" aria-hidden />
                  </span>
                  <DialogTitle>Order request recorded</DialogTitle>
                </div>
                <DialogDescription>
                  Your configuration for the {receipt.modelName} has been recorded against your account.
                  This is a simulated request, not a purchase.
                </DialogDescription>
              </DialogHeader>

              <dl className="divide-y divide-border rounded-lg border border-border">
                {[
                  ["Reference", receipt.reference],
                  ["Estimated total", formatCurrency(receipt.totalPrice, { decimals: 0 })],
                  ["Indicative delivery", formatDate(receipt.estimatedDelivery)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium tabular">{value}</dd>
                  </div>
                ))}
              </dl>

              <DialogFooter>
                <Button variant="outline" onClick={() => setReceipt(null)}>
                  Close
                </Button>
                <Button asChild>
                  <Link href={`/car-orders/${receipt.id}`}>Track this request</Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
