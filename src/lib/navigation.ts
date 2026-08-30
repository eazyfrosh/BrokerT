import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BadgeCheck,
  Banknote,
  Bell,
  CandlestickChart,
  Car,
  ClipboardList,
  Cog,
  Database,
  FileClock,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  PieChart,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  Star,
  TrendingUp,
  User,
  Users,
  Wallet,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match on exact path only (used for index routes). */
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const APP_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/portfolio", label: "Portfolio", icon: PieChart },
    ],
  },
  {
    label: "Trading",
    items: [
      { href: "/markets", label: "Markets", icon: CandlestickChart },
      { href: "/trade", label: "Trade", icon: ArrowLeftRight },
      { href: "/orders", label: "Orders", icon: ClipboardList },
      { href: "/watchlist", label: "Watchlist", icon: Star },
    ],
  },
  {
    label: "Investing",
    items: [
      { href: "/investments", label: "Strategies", icon: TrendingUp, exact: true },
      { href: "/investments/active", label: "My allocations", icon: BadgeCheck },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/wallet", label: "Wallet", icon: Wallet },
      { href: "/deposits", label: "Deposits", icon: Banknote },
      { href: "/withdrawals", label: "Withdrawals", icon: Receipt },
      { href: "/transactions", label: "Transactions", icon: ScrollText },
    ],
  },
  {
    label: "Vehicles",
    items: [
      { href: "/cars", label: "Marketplace", icon: Car, exact: true },
      { href: "/car-orders", label: "My orders", icon: ClipboardList },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/profile", label: "Profile", icon: User },
      { href: "/security", label: "Security", icon: Shield },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/support", label: "Support", icon: LifeBuoy },
    ],
  },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/admin/dashboard", label: "Dashboard", icon: Gauge }],
  },
  {
    label: "Customers",
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/kyc", label: "Verification", icon: BadgeCheck },
      { href: "/admin/support", label: "Support", icon: LifeBuoy },
    ],
  },
  {
    label: "Activity",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ClipboardList },
      { href: "/admin/transactions", label: "Transactions", icon: ScrollText },
      { href: "/admin/deposits", label: "Deposits", icon: Banknote },
      { href: "/admin/withdrawals", label: "Withdrawals", icon: Receipt },
      { href: "/admin/car-orders", label: "Vehicle orders", icon: Car },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/investments", label: "Strategies", icon: TrendingUp },
      { href: "/admin/market-data", label: "Market data", icon: Database },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/admin/notifications", label: "Notifications", icon: Megaphone },
      { href: "/admin/audit-logs", label: "Audit log", icon: FileClock },
      { href: "/admin/settings", label: "Settings", icon: Cog },
    ],
  },
];

/** Five destinations for the mobile bottom bar. */
export const MOBILE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/markets", label: "Markets", icon: CandlestickChart },
  { href: "/trade", label: "Trade", icon: ArrowLeftRight },
  { href: "/profile", label: "Profile", icon: User },
];

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
