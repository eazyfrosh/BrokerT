"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarNav } from "./app-sidebar";
import type { NavGroup } from "@/lib/navigation";

/** Full navigation in a drawer, for tablet and mobile. */
export function MobileSidebar({ groups, isAdmin }: { groups?: NavGroup[]; isAdmin?: boolean }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
      >
        <Menu />
      </Button>
      <SheetContent side="left" className="flex flex-col p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <SidebarNav groups={groups} isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
