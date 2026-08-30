"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AdminSidebarNav } from "./admin-sidebar";

export function AdminMobileSidebar() {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        aria-label="Open admin navigation"
        onClick={() => setOpen(true)}
      >
        <Menu />
      </Button>
      <SheetContent side="left" className="flex flex-col p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Admin console</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <AdminSidebarNav onNavigate={() => setOpen(false)} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
