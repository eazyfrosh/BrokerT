import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .max(254, "Email is too long")
  .transform((value) => value.toLowerCase());

/** Rejects the weak-password shapes that account-takeover tooling tries first. */
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Password is too long")
  .refine((v) => /[a-z]/.test(v), "Include a lowercase letter")
  .refine((v) => /[A-Z]/.test(v), "Include an uppercase letter")
  .refine((v) => /[0-9]/.test(v), "Include a number")
  .refine((v) => /[^A-Za-z0-9]/.test(v), "Include a symbol")
  .refine((v) => !/^(.)\1+$/.test(v), "Password is too repetitive");

export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number")
  .max(24, "Phone number is too long")
  .regex(/^[+]?[0-9()\-.\s]+$/, "Phone number contains invalid characters");

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Required")
  .max(60, "Too long")
  .regex(/^[\p{L}\p{M}'\-.\s]+$/u, "Use letters, spaces, hyphens and apostrophes only");

export const countrySchema = z.string().trim().min(2, "Select your country").max(56);

export const uuidSchema = z.string().uuid("Invalid identifier");

/** Monetary amount from a form field, guarded against NaN and silly precision. */
export const moneySchema = z
  .coerce.number({ message: "Enter an amount" })
  .finite("Enter a valid amount")
  .positive("Amount must be greater than zero")
  .max(10_000_000, "Amount exceeds the platform limit")
  .refine((v) => Number.isFinite(v) && Math.round(v * 100) === Number((v * 100).toFixed(0)), {
    message: "Use at most two decimal places",
  });

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export const registerSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    country: countrySchema,
    phone: phoneSchema,
    acceptTerms: z.literal(true, { message: "You must accept the terms to continue" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => !data.password.toLowerCase().includes(data.email.split("@")[0].toLowerCase()), {
    message: "Password must not contain your email name",
    path: ["password"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.password !== data.currentPassword, {
    message: "Choose a password you have not used before",
    path: ["password"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/* ------------------------------------------------------------------ */
/* Profile & settings                                                  */
/* ------------------------------------------------------------------ */

export const profileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema.or(z.literal("")),
  country: countrySchema,
  avatarUrl: z.string().url("Enter a valid URL").or(z.literal("")).optional(),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const settingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  emailOrderUpdates: z.boolean(),
  emailInvestmentUpdates: z.boolean(),
  emailSecurityAlerts: z.boolean(),
  emailMarketing: z.boolean(),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

/* ------------------------------------------------------------------ */
/* Trading                                                             */
/* ------------------------------------------------------------------ */

export const orderSideSchema = z.enum(["buy", "sell"]);
export const orderTypeSchema = z.enum(["market", "limit", "stop", "stop_limit"]);
export const timeInForceSchema = z.enum(["day", "gtc", "ioc", "fok"]);

export const placeOrderSchema = z
  .object({
    assetId: uuidSchema,
    side: orderSideSchema,
    orderType: orderTypeSchema,
    quantity: z.coerce
      .number({ message: "Enter a quantity" })
      .finite("Enter a valid quantity")
      .positive("Quantity must be greater than zero")
      .max(1_000_000, "Quantity exceeds the platform limit"),
    limitPrice: z.coerce.number().positive().max(1_000_000).optional().nullable(),
    stopPrice: z.coerce.number().positive().max(1_000_000).optional().nullable(),
    timeInForce: timeInForceSchema.default("day"),
  })
  .refine((d) => !(d.orderType === "limit" || d.orderType === "stop_limit") || !!d.limitPrice, {
    message: "A limit price is required for this order type",
    path: ["limitPrice"],
  })
  .refine((d) => !(d.orderType === "stop" || d.orderType === "stop_limit") || !!d.stopPrice, {
    message: "A stop price is required for this order type",
    path: ["stopPrice"],
  });
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export const cancelOrderSchema = z.object({ orderId: uuidSchema });

/* ------------------------------------------------------------------ */
/* Investments                                                         */
/* ------------------------------------------------------------------ */

export const allocateInvestmentSchema = z.object({
  investmentId: uuidSchema,
  amount: moneySchema,
  acknowledgeRisk: z.literal(true, { message: "Confirm you have read the risk disclosure" }),
});
export type AllocateInvestmentInput = z.infer<typeof allocateInvestmentSchema>;

export const adminInvestmentSchema = z.object({
  id: uuidSchema.optional(),
  slug: z
    .string()
    .trim()
    .min(3, "Slug is too short")
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens"),
  name: z.string().trim().min(3, "Name is required").max(120),
  category: z.string().trim().min(2).max(60),
  summary: z.string().trim().min(10, "Write a short summary").max(280),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  objective: z.string().trim().max(1000).optional().or(z.literal("")),
  riskLevel: z.enum(["conservative", "moderate", "balanced", "growth", "aggressive"]),
  riskDisclosure: z.string().trim().min(20, "A risk disclosure is required").max(4000),
  terms: z.string().trim().max(4000).optional().or(z.literal("")),
  targetReturnPct: z.coerce.number().min(0).max(200),
  durationMonths: z.coerce.number().int().min(1).max(600),
  minimumAmount: z.coerce.number().min(0).max(10_000_000),
  maximumAmount: z.coerce.number().min(0).max(100_000_000).optional().nullable(),
  managementFeePct: z.coerce.number().min(0).max(20),
  performanceFeePct: z.coerce.number().min(0).max(50),
  capacityAmount: z.coerce.number().min(0).max(1_000_000_000).optional().nullable(),
  status: z.enum(["draft", "open", "paused", "closed", "archived"]),
  imageUrl: z.string().url().or(z.literal("")).optional(),
});
export type AdminInvestmentInput = z.infer<typeof adminInvestmentSchema>;

/* ------------------------------------------------------------------ */
/* Wallet                                                              */
/* ------------------------------------------------------------------ */

export const cashMovementSchema = z.object({
  type: z.enum(["deposit", "withdrawal"]),
  amount: moneySchema,
  method: z.string().trim().min(1).max(40).default("demo"),
});
export type CashMovementInput = z.infer<typeof cashMovementSchema>;

/* ------------------------------------------------------------------ */
/* Vehicles                                                            */
/* ------------------------------------------------------------------ */

export const carOrderSchema = z.object({
  vehicleId: uuidSchema,
  trim: z.string().trim().min(1, "Choose a trim").max(60),
  exterior: z.string().trim().min(1, "Choose a paint colour").max(60),
  interior: z.string().trim().min(1, "Choose an interior").max(60),
  wheels: z.string().trim().min(1, "Choose wheels").max(60),
  options: z.array(z.string().trim().max(60)).max(20).default([]),
  fullName: z.string().trim().min(2, "Enter the full name").max(120),
  email: emailSchema,
  phone: phoneSchema,
  addressLine1: z.string().trim().min(3, "Enter a street address").max(160),
  addressLine2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Enter a city").max(80),
  region: z.string().trim().min(1, "Enter a state or region").max(80),
  postalCode: z.string().trim().min(2, "Enter a postal code").max(20),
  country: countrySchema,
  acknowledgeDemo: z.literal(true, { message: "Acknowledge this is a simulated order request" }),
});
export type CarOrderInput = z.infer<typeof carOrderSchema>;

/* ------------------------------------------------------------------ */
/* Support & contact                                                   */
/* ------------------------------------------------------------------ */

export const supportTicketSchema = z.object({
  subject: z.string().trim().min(4, "Enter a subject").max(140),
  category: z.string().trim().min(2).max(60).default("General"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  message: z.string().trim().min(10, "Describe the issue in a little more detail").max(4000),
});
export type SupportTicketInput = z.infer<typeof supportTicketSchema>;

export const supportReplySchema = z.object({
  ticketId: uuidSchema,
  body: z.string().trim().min(1, "Write a reply").max(4000),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: emailSchema,
  subject: z.string().trim().min(4, "Enter a subject").max(140),
  message: z.string().trim().min(10, "Tell us a little more").max(4000),
});
export type ContactInput = z.infer<typeof contactSchema>;

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export const adminUserStatusSchema = z.object({
  userId: uuidSchema,
  status: z.enum(["pending", "active", "suspended", "closed"]),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const adminUserRoleSchema = z.object({
  userId: uuidSchema,
  role: z.enum(["user", "admin", "super_admin"]),
});

export const adminOrderStatusSchema = z.object({
  orderId: uuidSchema,
  status: z.enum(["pending", "submitted", "filled", "partially_filled", "cancelled", "rejected"]),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const adminCarOrderSchema = z.object({
  carOrderId: uuidSchema,
  status: z
    .enum([
      "configuration",
      "order_request",
      "processing",
      "confirmed",
      "preparing",
      "ready",
      "completed",
      "cancelled",
    ])
    .optional(),
  estimatedDelivery: z.string().trim().max(20).optional().or(z.literal("")),
  internalNotes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const adminNotificationSchema = z.object({
  title: z.string().trim().min(3, "Enter a title").max(140),
  message: z.string().trim().min(5, "Enter a message").max(1000),
  type: z.enum([
    "order_filled",
    "order_update",
    "investment_update",
    "portfolio_alert",
    "security_alert",
    "new_investment",
    "car_order_update",
    "system",
  ]),
  link: z.string().trim().max(200).optional().or(z.literal("")),
  target: z.enum(["all", "selected"]),
  userIds: z.array(uuidSchema).max(500).optional(),
});
export type AdminNotificationInput = z.infer<typeof adminNotificationSchema>;

export const adminKycSchema = z.object({
  userId: uuidSchema,
  status: z.enum(["not_started", "pending", "approved", "rejected"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

/* ------------------------------------------------------------------ */
/* Watchlist                                                           */
/* ------------------------------------------------------------------ */

export const watchlistItemSchema = z.object({
  assetId: uuidSchema,
  note: z.string().trim().max(200).optional().or(z.literal("")),
});
