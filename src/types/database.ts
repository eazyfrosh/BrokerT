/**
 * Application-level domain types.
 *
 * These mirror the SQL in `supabase/migrations`. Keeping them hand-authored (as
 * opposed to fully generated) lets the app layer express nullability and unions
 * precisely; regenerate-and-diff remains possible via the Supabase CLI.
 */

export type UserRole = "user" | "admin" | "super_admin";
export type AccountStatus = "pending" | "active" | "suspended" | "closed";
export type KycStatus = "not_started" | "pending" | "approved" | "rejected";

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop" | "stop_limit";
export type OrderStatus =
  | "pending"
  | "submitted"
  | "filled"
  | "partially_filled"
  | "cancelled"
  | "rejected";
export type TimeInForce = "day" | "gtc" | "ioc" | "fok";

export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "buy"
  | "sell"
  | "investment"
  | "investment_return"
  | "fee"
  | "refund";
export type TransactionStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export type RiskLevel = "conservative" | "moderate" | "balanced" | "growth" | "aggressive";
export type InvestmentStatus = "draft" | "open" | "paused" | "closed" | "archived";
export type InvestmentPositionStatus = "active" | "matured" | "withdrawn" | "cancelled";

export type CarOrderStatus =
  | "configuration"
  | "order_request"
  | "processing"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export type NotificationType =
  | "order_filled"
  | "order_update"
  | "investment_update"
  | "portfolio_alert"
  | "security_alert"
  | "new_investment"
  | "car_order_update"
  | "system";

export type SupportTicketStatus = "open" | "pending" | "resolved" | "closed";
export type SupportTicketPriority = "low" | "normal" | "high" | "urgent";

export type ThemePreference = "light" | "dark" | "system";

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  country: string | null;
  avatar_url: string | null;
  role: UserRole;
  account_status: AccountStatus;
  kyc_status: KycStatus;
  two_factor_enabled: boolean;
  email_verified_at: string | null;
  last_login_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  user_id: string;
  theme: ThemePreference;
  email_order_updates: boolean;
  email_investment_updates: boolean;
  email_security_alerts: boolean;
  email_marketing: boolean;
  push_enabled: boolean;
  base_currency: string;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  currency: string;
  available_balance: number;
  pending_balance: number;
  reserved_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  exchange: string | null;
  asset_class: string;
  currency: string;
  sector: string | null;
  description: string | null;
  logo_url: string | null;
  is_tradable: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketQuote {
  id: string;
  asset_id: string;
  price: number;
  previous_close: number;
  open_price: number;
  day_high: number;
  day_low: number;
  volume: number;
  market_cap: number | null;
  week52_high: number | null;
  week52_low: number | null;
  source: string;
  is_simulated: boolean;
  quoted_at: string;
  updated_at: string;
}

export interface MarketCandle {
  asset_id: string;
  bucket_start: string;
  interval: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  is_simulated: boolean;
}

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface PortfolioHolding {
  id: string;
  portfolio_id: string;
  user_id: string;
  asset_id: string;
  quantity: number;
  average_cost: number;
  realized_pnl: number;
  created_at: string;
  updated_at: string;
}

export interface PortfolioSnapshot {
  id: string;
  user_id: string;
  captured_on: string;
  total_value: number;
  holdings_value: number;
  cash_balance: number;
  invested_value: number;
  created_at: string;
}

export interface Order {
  id: string;
  reference: string;
  user_id: string;
  asset_id: string;
  side: OrderSide;
  order_type: OrderType;
  time_in_force: TimeInForce;
  quantity: number;
  filled_quantity: number;
  limit_price: number | null;
  stop_price: number | null;
  estimated_price: number | null;
  average_fill_price: number | null;
  fees: number;
  status: OrderStatus;
  rejection_reason: string | null;
  is_simulated: boolean;
  submitted_at: string | null;
  filled_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderFill {
  id: string;
  order_id: string;
  user_id: string;
  quantity: number;
  price: number;
  fees: number;
  filled_at: string;
}

export interface Investment {
  id: string;
  slug: string;
  name: string;
  category: string;
  summary: string;
  description: string | null;
  objective: string | null;
  risk_level: RiskLevel;
  risk_disclosure: string | null;
  terms: string | null;
  target_return_pct: number;
  duration_months: number;
  minimum_amount: number;
  maximum_amount: number | null;
  management_fee_pct: number;
  performance_fee_pct: number;
  capacity_amount: number | null;
  raised_amount: number;
  status: InvestmentStatus;
  image_url: string | null;
  is_simulated: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvestmentPosition {
  id: string;
  reference: string;
  user_id: string;
  investment_id: string;
  principal: number;
  current_value: number;
  target_return_pct: number;
  start_date: string;
  target_date: string;
  status: InvestmentPositionStatus;
  is_simulated: boolean;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  reference: string;
  user_id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  balance_after: number | null;
  description: string | null;
  related_order_id: string | null;
  related_investment_position_id: string | null;
  related_car_order_id: string | null;
  payment_method: string | null;
  is_simulated: boolean;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface WatchlistItem {
  id: string;
  watchlist_id: string;
  user_id: string;
  asset_id: string;
  note: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  slug: string;
  model_name: string;
  tagline: string | null;
  description: string | null;
  base_price: number;
  range_miles: number;
  top_speed_mph: number;
  acceleration_0_60: number;
  drive_type: string;
  seating: number;
  features: string[];
  image_url: string | null;
  is_available: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type VehicleOptionKind = "trim" | "exterior" | "interior" | "wheels" | "option";

export interface VehicleOption {
  id: string;
  vehicle_id: string;
  kind: VehicleOptionKind;
  code: string;
  name: string;
  description: string | null;
  price_delta: number;
  swatch: string | null;
  range_delta_miles: number;
  is_default: boolean;
  display_order: number;
  created_at: string;
}

export interface CarOrderConfiguration {
  trim: string;
  exterior: string;
  interior: string;
  wheels: string;
  options: string[];
}

export interface CarOrder {
  id: string;
  reference: string;
  user_id: string;
  vehicle_id: string;
  configuration: CarOrderConfiguration;
  configuration_summary: string | null;
  total_price: number;
  deposit_amount: number;
  status: CarOrderStatus;
  delivery_full_name: string | null;
  delivery_email: string | null;
  delivery_phone: string | null;
  delivery_address_line1: string | null;
  delivery_address_line2: string | null;
  delivery_city: string | null;
  delivery_region: string | null;
  delivery_postal_code: string | null;
  delivery_country: string | null;
  estimated_delivery: string | null;
  internal_notes: string | null;
  is_simulated: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  read_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  reference: string;
  user_id: string;
  subject: string;
  category: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  author_id: string | null;
  is_staff: boolean;
  body: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface LoginEvent {
  id: string;
  user_id: string;
  event: "login" | "logout" | "failed_login" | "password_change" | "password_reset";
  ip_address: string | null;
  user_agent: string | null;
  location: string | null;
  succeeded: boolean;
  created_at: string;
}

export interface SystemSetting {
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}
