"use client";

import * as React from "react";
import { useActionState } from "react";
import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FormMessage } from "@/components/shared/form-message";
import { SubmitButton } from "@/components/shared/submit-button";
import { updateSettingsAction } from "@/lib/actions/profile";
import type { ActionResult } from "@/lib/actions/result";
import type { UserSettings } from "@/types/database";

const EMAIL_PREFERENCES = [
  {
    name: "emailOrderUpdates",
    label: "Order updates",
    description: "Confirmations when an order is placed, filled or cancelled.",
    key: "email_order_updates" as const,
  },
  {
    name: "emailInvestmentUpdates",
    label: "Investment updates",
    description: "Allocation confirmations and strategy notices.",
    key: "email_investment_updates" as const,
  },
  {
    name: "emailSecurityAlerts",
    label: "Security alerts",
    description: "Password changes and sign-in activity. Strongly recommended.",
    key: "email_security_alerts" as const,
  },
  {
    name: "emailMarketing",
    label: "Product news",
    description: "Occasional updates about new features. Off by default.",
    key: "email_marketing" as const,
  },
];

export function SettingsForm({ settings }: { settings: UserSettings | null }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateSettingsAction, null);
  const { theme, setTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = React.useState(settings?.theme ?? "system");

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state?.ok && state.message && <FormMessage variant="success">{state.message}</FormMessage>}
      {state && !state.ok && <FormMessage variant="error">{state.error}</FormMessage>}

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Appearance</legend>
        <div className="space-y-1.5">
          <Label htmlFor="theme">Theme</Label>
          <Select
            value={selectedTheme}
            onValueChange={(value) => {
              setSelectedTheme(value as UserSettings["theme"]);
              // Apply immediately so the choice is visible before saving.
              setTheme(value);
            }}
          >
            <SelectTrigger id="theme" className="sm:max-w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">Match my system</SelectItem>
            </SelectContent>
          </Select>
          <input type="hidden" name="theme" value={selectedTheme} />
          <p className="text-xs text-muted-foreground">
            Applied immediately on this device; saving stores it on your account.
            {theme && theme !== selectedTheme ? " Save to keep this choice." : ""}
          </p>
        </div>
      </fieldset>

      <Separator />

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Email notifications</legend>
        {EMAIL_PREFERENCES.map((preference) => (
          <div key={preference.name} className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor={preference.name} className="text-sm font-medium">
                {preference.label}
              </Label>
              <p className="mt-0.5 text-sm text-muted-foreground">{preference.description}</p>
            </div>
            <Switch
              id={preference.name}
              name={preference.name}
              defaultChecked={settings?.[preference.key] ?? preference.name !== "emailMarketing"}
              className="mt-1 shrink-0"
            />
          </div>
        ))}
      </fieldset>

      <SubmitButton pendingLabel="Saving…">Save preferences</SubmitButton>
    </form>
  );
}
