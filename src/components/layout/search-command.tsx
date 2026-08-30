"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { APP_NAV } from "@/lib/navigation";
import type { SearchResult } from "@/app/api/search/route";

/**
 * Global search. Navigation destinations are matched locally for instant
 * feedback; records are fetched from the search endpoint, debounced.
 */
export function SearchCommand() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function onQueryChange(value: string) {
    setQuery(value);
    // Decide the pending state here rather than in the effect: below the
    // threshold there is nothing to fetch, so drop stale results immediately.
    if (value.trim().length < 2) {
      setResults([]);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }

  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(String(response.status));
        const payload = (await response.json()) as { results: SearchResult[] };
        setResults(payload.results);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const grouped = React.useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const result of results) {
      const list = map.get(result.group) ?? [];
      list.push(result);
      map.set(result.group, list);
    }
    return [...map.entries()];
  }, [results]);

  const navItems = React.useMemo(() => APP_NAV.flatMap((group) => group.items), []);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 w-full justify-start gap-2 px-3 text-muted-foreground sm:max-w-64"
      >
        <Search className="size-4" />
        <span className="text-sm">Search…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.625rem] sm:inline-block">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} title="Search BrokerT">
        <CommandInput
          placeholder="Search orders, strategies, vehicles, markets…"
          value={query}
          onValueChange={onQueryChange}
        />
        <CommandList>
          <CommandEmpty>
            {loading ? "Searching…" : query.trim().length < 2 ? "Type at least two characters." : "No results found."}
          </CommandEmpty>

          {grouped.map(([group, items]) => (
            <CommandGroup key={group} heading={group}>
              {items.map((item) => (
                <CommandItem key={item.id} value={`${item.title} ${item.subtitle ?? ""}`} onSelect={() => go(item.href)}>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{item.title}</p>
                    {item.subtitle && (
                      <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}

          <CommandGroup heading="Go to">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
                  <Icon />
                  {item.label}
                  <CommandShortcut>{item.href}</CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
