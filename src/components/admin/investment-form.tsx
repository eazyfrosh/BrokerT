"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminSaveInvestmentAction } from "@/lib/actions/admin";
import type { Investment } from "@/types/database";

const RISK_LEVELS = ["conservative", "moderate", "balanced", "growth", "aggressive"] as const;
const STATUSES = ["draft", "open", "paused", "closed", "archived"] as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function InvestmentForm({ investment }: { investment?: Investment }) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const [name, setName] = React.useState(investment?.name ?? "");
  const [slug, setSlug] = React.useState(investment?.slug ?? "");
  const [slugTouched, setSlugTouched] = React.useState(Boolean(investment));
  const [riskLevel, setRiskLevel] = React.useState<string>(investment?.risk_level ?? "balanced");
  const [status, setStatus] = React.useState<string>(investment?.status ?? "draft");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const value = (key: string) => formData.get(key)?.toString() ?? "";
    const optionalNumber = (key: string) => {
      const raw = value(key).trim();
      return raw === "" ? null : Number(raw);
    };

    const result = await adminSaveInvestmentAction({
      id: investment?.id,
      slug,
      name,
      category: value("category"),
      summary: value("summary"),
      description: value("description"),
      objective: value("objective"),
      riskLevel,
      riskDisclosure: value("riskDisclosure"),
      terms: value("terms"),
      targetReturnPct: Number(value("targetReturnPct")),
      durationMonths: Number(value("durationMonths")),
      minimumAmount: Number(value("minimumAmount")),
      maximumAmount: optionalNumber("maximumAmount"),
      managementFeePct: Number(value("managementFeePct")),
      performanceFeePct: Number(value("performanceFeePct")),
      capacityAmount: optionalNumber("capacityAmount"),
      status,
      imageUrl: value("imageUrl"),
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      return;
    }

    toast.success(result.message ?? "Saved");
    router.push("/admin/investments");
    router.refresh();
  }

  function Field({
    name: fieldName,
    label,
    children,
    hint,
    className,
  }: {
    name: string;
    label: string;
    children: React.ReactNode;
    hint?: string;
    className?: string;
  }) {
    return (
      <div className={className}>
        <Label htmlFor={fieldName} className="mb-1.5 block">
          {label}
        </Label>
        {children}
        {hint && !fieldErrors[fieldName] && (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
        {fieldErrors[fieldName] && (
          <p className="mt-1 text-xs font-medium text-destructive">{fieldErrors[fieldName]}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          {error}
        </p>
      )}

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Identity</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="name" label="Name">
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slugTouched) setSlug(slugify(event.target.value));
              }}
              required
            />
          </Field>

          <Field name="slug" label="Slug" hint="Used in the public URL.">
            <Input
              id="slug"
              name="slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugify(event.target.value));
              }}
              required
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="category" label="Category">
            <Input id="category" name="category" defaultValue={investment?.category ?? "Thematic"} required />
          </Field>

          <Field name="imageUrl" label="Image URL (optional)">
            <Input id="imageUrl" name="imageUrl" type="url" defaultValue={investment?.image_url ?? ""} />
          </Field>
        </div>

        <Field name="summary" label="Summary" hint="One or two sentences shown on the strategy card.">
          <Textarea id="summary" name="summary" rows={2} defaultValue={investment?.summary ?? ""} required />
        </Field>
      </fieldset>

      <Separator />

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Description</legend>

        <Field name="objective" label="Investment objective">
          <Textarea id="objective" name="objective" rows={3} defaultValue={investment?.objective ?? ""} />
        </Field>

        <Field name="description" label="Overview">
          <Textarea id="description" name="description" rows={5} defaultValue={investment?.description ?? ""} />
        </Field>
      </fieldset>

      <Separator />

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Terms and targets</legend>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            name="targetReturnPct"
            label="Target return (%)"
            hint="An illustrative projection, never presented as guaranteed."
          >
            <Input
              id="targetReturnPct"
              name="targetReturnPct"
              inputMode="decimal"
              defaultValue={investment?.target_return_pct ?? 0}
              required
            />
          </Field>

          <Field name="durationMonths" label="Target duration (months)">
            <Input
              id="durationMonths"
              name="durationMonths"
              inputMode="numeric"
              defaultValue={investment?.duration_months ?? 12}
              required
            />
          </Field>

          <Field name="riskLevel" label="Risk level">
            <Select value={riskLevel} onValueChange={setRiskLevel}>
              <SelectTrigger id="riskLevel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map((level) => (
                  <SelectItem key={level} value={level} className="capitalize">
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field name="minimumAmount" label="Minimum amount">
            <Input
              id="minimumAmount"
              name="minimumAmount"
              inputMode="decimal"
              defaultValue={investment?.minimum_amount ?? 0}
              required
            />
          </Field>

          <Field name="maximumAmount" label="Maximum amount" hint="Leave empty for no maximum.">
            <Input
              id="maximumAmount"
              name="maximumAmount"
              inputMode="decimal"
              defaultValue={investment?.maximum_amount ?? ""}
            />
          </Field>

          <Field name="capacityAmount" label="Capacity" hint="Leave empty for uncapped.">
            <Input
              id="capacityAmount"
              name="capacityAmount"
              inputMode="decimal"
              defaultValue={investment?.capacity_amount ?? ""}
            />
          </Field>

          <Field name="managementFeePct" label="Management fee (%)">
            <Input
              id="managementFeePct"
              name="managementFeePct"
              inputMode="decimal"
              defaultValue={investment?.management_fee_pct ?? 0}
              required
            />
          </Field>

          <Field name="performanceFeePct" label="Performance fee (%)">
            <Input
              id="performanceFeePct"
              name="performanceFeePct"
              inputMode="decimal"
              defaultValue={investment?.performance_fee_pct ?? 0}
              required
            />
          </Field>

          <Field name="status" label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((value) => (
                  <SelectItem key={value} value={value} className="capitalize">
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </fieldset>

      <Separator />

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Disclosures</legend>

        <div className="rounded-lg border border-warning/30 bg-warning/8 px-3 py-2.5 text-xs leading-relaxed">
          A risk disclosure is required. Describe what could go wrong in concrete terms — concentration,
          illiquidity, drawdown history, fee drag — and never describe the target return as guaranteed,
          promised or assured.
        </div>

        <Field name="riskDisclosure" label="Risk disclosure">
          <Textarea
            id="riskDisclosure"
            name="riskDisclosure"
            rows={5}
            defaultValue={investment?.risk_disclosure ?? ""}
            required
          />
        </Field>

        <Field name="terms" label="Terms">
          <Textarea id="terms" name="terms" rows={4} defaultValue={investment?.terms ?? ""} />
        </Field>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={saving}>
          {investment ? "Save strategy" : "Create strategy"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/investments")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
