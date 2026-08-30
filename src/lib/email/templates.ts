import { APP, DEMO_MODE } from "@/lib/config";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function shell(title: string, bodyHtml: string): string {
  const demoBanner = DEMO_MODE
    ? `<p style="margin:0 0 16px;padding:10px 14px;background:#fff8e6;border:1px solid #f0d089;border-radius:8px;font-size:13px;color:#6b5307;">
         <strong>Demo mode.</strong> ${APP.demoNotice}
       </p>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#17181b;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
    <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
      <span style="font-size:16px;font-weight:600;letter-spacing:-0.01em;">${APP.name}</span>
    </div>
    <div style="padding:24px;font-size:14px;line-height:1.6;">
      ${demoBanner}
      ${bodyHtml}
    </div>
    <div style="padding:18px 24px;border-top:1px solid #e5e7eb;background:#fafafa;font-size:11px;line-height:1.6;color:#6b7280;">
      <p style="margin:0 0 8px;">${APP.trademarkNotice}</p>
      <p style="margin:0;">${APP.riskNotice}</p>
    </div>
  </div>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0;"><a href="${href}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${label}</a></p>`;
}

export function welcomeEmail(to: string, firstName: string | null, appUrl: string): EmailMessage {
  const name = firstName ? ` ${firstName}` : "";
  return {
    to,
    subject: `Welcome to ${APP.name}`,
    html: shell(
      "Welcome",
      `<h1 style="margin:0 0 12px;font-size:19px;">Welcome${name}</h1>
       <p style="margin:0 0 12px;">Your ${APP.name} account is ready. You can follow TSLA market data, build a portfolio, place orders and review investment strategies.</p>
       <p style="margin:0;">${APP.name} is an independent platform and is not affiliated with Tesla, Inc.</p>
       ${button(`${appUrl}/dashboard`, "Open your dashboard")}`,
    ),
    text: `Welcome${name}. Your ${APP.name} account is ready: ${appUrl}/dashboard\n\n${APP.trademarkNotice}`,
  };
}

export function orderConfirmationEmail(
  to: string,
  params: { reference: string; side: string; quantity: string; symbol: string; price: string; total: string },
  appUrl: string,
): EmailMessage {
  return {
    to,
    subject: `Order ${params.reference} confirmed`,
    html: shell(
      "Order confirmed",
      `<h1 style="margin:0 0 12px;font-size:19px;">Order confirmed</h1>
       <table style="width:100%;border-collapse:collapse;font-size:13px;">
         <tr><td style="padding:6px 0;color:#6b7280;">Reference</td><td style="padding:6px 0;text-align:right;font-weight:600;">${params.reference}</td></tr>
         <tr><td style="padding:6px 0;color:#6b7280;">Side</td><td style="padding:6px 0;text-align:right;font-weight:600;">${params.side}</td></tr>
         <tr><td style="padding:6px 0;color:#6b7280;">Instrument</td><td style="padding:6px 0;text-align:right;font-weight:600;">${params.symbol}</td></tr>
         <tr><td style="padding:6px 0;color:#6b7280;">Quantity</td><td style="padding:6px 0;text-align:right;font-weight:600;">${params.quantity}</td></tr>
         <tr><td style="padding:6px 0;color:#6b7280;">Price</td><td style="padding:6px 0;text-align:right;font-weight:600;">${params.price}</td></tr>
         <tr><td style="padding:6px 0;color:#6b7280;">Total</td><td style="padding:6px 0;text-align:right;font-weight:600;">${params.total}</td></tr>
       </table>
       ${button(`${appUrl}/orders`, "View your orders")}`,
    ),
    text: `Order ${params.reference} confirmed: ${params.side} ${params.quantity} ${params.symbol} @ ${params.price} (total ${params.total}). ${appUrl}/orders`,
  };
}

export function securityAlertEmail(to: string, event: string, appUrl: string): EmailMessage {
  return {
    to,
    subject: `Security alert: ${event}`,
    html: shell(
      "Security alert",
      `<h1 style="margin:0 0 12px;font-size:19px;">Security alert</h1>
       <p style="margin:0 0 12px;">We recorded the following change on your account: <strong>${event}</strong>.</p>
       <p style="margin:0;">If this was not you, change your password immediately and review your active sessions.</p>
       ${button(`${appUrl}/security`, "Review account security")}`,
    ),
    text: `Security alert: ${event}. If this was not you, change your password at ${appUrl}/security`,
  };
}

export function investmentUpdateEmail(
  to: string,
  params: { name: string; reference: string; amount: string },
  appUrl: string,
): EmailMessage {
  return {
    to,
    subject: `Allocation confirmed — ${params.name}`,
    html: shell(
      "Allocation confirmed",
      `<h1 style="margin:0 0 12px;font-size:19px;">Allocation confirmed</h1>
       <p style="margin:0 0 12px;">Your allocation of <strong>${params.amount}</strong> to <strong>${params.name}</strong> is active (reference ${params.reference}).</p>
       <p style="margin:0;">Target returns for this strategy are illustrative projections and are not guaranteed.</p>
       ${button(`${appUrl}/investments/active`, "View your allocations")}`,
    ),
    text: `Allocation of ${params.amount} to ${params.name} (${params.reference}) is active. Target returns are illustrative, not guaranteed. ${appUrl}/investments/active`,
  };
}

export function carOrderEmail(
  to: string,
  params: { reference: string; model: string; total: string },
  appUrl: string,
): EmailMessage {
  return {
    to,
    subject: `Vehicle order request ${params.reference}`,
    html: shell(
      "Vehicle order request received",
      `<h1 style="margin:0 0 12px;font-size:19px;">Order request received</h1>
       <p style="margin:0 0 12px;">We have recorded your configuration for the <strong>${params.model}</strong> at <strong>${params.total}</strong>, reference ${params.reference}.</p>
       <p style="margin:0;">This is a simulated order request in an independent demo marketplace. It is not a purchase, it does not reserve a vehicle, and it is not connected to any manufacturer or dealer system.</p>
       ${button(`${appUrl}/car-orders`, "Track this request")}`,
    ),
    text: `Vehicle order request ${params.reference} for the ${params.model} (${params.total}) received. This is a simulated request, not a purchase. ${appUrl}/car-orders`,
  };
}
