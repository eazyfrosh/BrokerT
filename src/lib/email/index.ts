import "server-only";

import { Resend } from "resend";
import { serverEnv, publicEnv } from "@/lib/config";
import type { EmailMessage } from "./templates";

export * from "./templates";

/**
 * Email transport seam.
 *
 * With RESEND_API_KEY set, messages are delivered through Resend. Without it
 * they are logged, so local development and CI never depend on an outbound
 * mail provider and never send to a real inbox by accident.
 */
export async function sendEmail(message: EmailMessage): Promise<{ sent: boolean; error?: string }> {
  const { resendApiKey, emailFrom } = serverEnv();

  if (!resendApiKey) {
    console.info(`[email:noop] to=${message.to} subject=${JSON.stringify(message.subject)}`);
    return { sent: false, error: "No email provider configured" };
  }

  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: emailFrom,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (error) {
      console.error("[email:error]", error.message);
      return { sent: false, error: error.message };
    }
    return { sent: true };
  } catch (error) {
    // Email must never break the transaction that triggered it.
    console.error("[email:exception]", error);
    return { sent: false, error: "Email delivery failed" };
  }
}

export function appUrl(): string {
  return publicEnv.appUrl;
}
