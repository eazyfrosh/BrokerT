"use client";

import { LogOut } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { logoutAction } from "@/lib/actions/auth";

export function LogoutButton({ children, ...props }: ButtonProps) {
  return (
    <form action={logoutAction} className={props.className ? undefined : "contents"}>
      <Button type="submit" {...props}>
        <LogOut />
        {children ?? "Sign out"}
      </Button>
    </form>
  );
}
