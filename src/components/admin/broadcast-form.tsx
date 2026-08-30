"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Megaphone, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { adminBroadcastNotificationAction } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";
import type { NotificationType, Profile } from "@/types/database";

const TYPES: { value: NotificationType; label: string }[] = [
  { value: "system", label: "System" },
  { value: "portfolio_alert", label: "Portfolio alert" },
  { value: "new_investment", label: "New strategy" },
  { value: "investment_update", label: "Investment update" },
  { value: "order_update", label: "Order update" },
  { value: "security_alert", label: "Security alert" },
];

export function BroadcastForm({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [link, setLink] = React.useState("");
  const [type, setType] = React.useState<NotificationType>("system");
  const [target, setTarget] = React.useState<"all" | "selected">("all");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [query, setQuery] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const activeCount = profiles.filter((p) => p.account_status === "active").length;

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return profiles.slice(0, 60);
    return profiles
      .filter((profile) =>
        `${profile.email} ${profile.first_name ?? ""} ${profile.last_name ?? ""}`
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, 60);
  }, [profiles, query]);

  const canSend =
    title.trim().length >= 3 &&
    message.trim().length >= 5 &&
    (target === "all" || selected.length > 0);

  async function send() {
    setSending(true);
    setError(null);

    const result = await adminBroadcastNotificationAction({
      title,
      message,
      type,
      link,
      target,
      userIds: target === "selected" ? selected : undefined,
    });

    setSending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setConfirmOpen(false);
    toast.success(result.message ?? "Notification sent");
    setTitle("");
    setMessage("");
    setLink("");
    setSelected([]);
    router.refresh();
  }

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="broadcast-title">Title</Label>
          <Input
            id="broadcast-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Scheduled maintenance on Sunday"
            maxLength={140}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="broadcast-message">Message</Label>
          <Textarea
            id="broadcast-message"
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="What customers need to know, in plain language."
            maxLength={1000}
          />
          <p className="text-xs text-muted-foreground">{message.length}/1000</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="broadcast-type">Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as NotificationType)}>
              <SelectTrigger id="broadcast-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="broadcast-link">Link (optional)</Label>
            <Input
              id="broadcast-link"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="/investments"
            />
          </div>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Recipients</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["all", `All active users (${activeCount})`],
                ["selected", "Selected users"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={target === value}
                onClick={() => setTarget(value)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  target === value ? "border-primary bg-primary/6" : "border-border hover:border-primary/40",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {target === "selected" && (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search customers…"
                  className="pl-8.5"
                  aria-label="Search customers"
                />
              </div>

              <ScrollArea className="max-h-56">
                <ul className="space-y-1 pr-2">
                  {filtered.map((profile) => (
                    <li key={profile.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/50">
                        <Checkbox
                          checked={selected.includes(profile.id)}
                          onCheckedChange={(value) =>
                            setSelected((current) =>
                              value === true
                                ? [...current, profile.id]
                                : current.filter((id) => id !== profile.id),
                            )
                          }
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">{profile.email}</span>
                        <Badge variant="muted" className="shrink-0 text-[0.625rem]">
                          {profile.account_status}
                        </Badge>
                      </label>
                    </li>
                  ))}
                </ul>
              </ScrollArea>

              <p className="text-xs text-muted-foreground">
                {selected.length} selected{query && ` · showing ${filtered.length} matches`}
              </p>
            </div>
          )}
        </fieldset>

        {error && (
          <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <Button disabled={!canSend} onClick={() => setConfirmOpen(true)}>
          <Megaphone /> Send notification
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Send this notification?"
        description={
          target === "all"
            ? `It will be delivered to all ${activeCount} active users and cannot be recalled.`
            : `It will be delivered to ${selected.length} selected ${selected.length === 1 ? "user" : "users"} and cannot be recalled.`
        }
        confirmLabel="Send"
        loading={sending}
        onConfirm={send}
      >
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
      </ConfirmDialog>
    </>
  );
}
