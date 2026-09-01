import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, Mail, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/marketing/section";
import { ContactForm } from "./contact-form";
import { getSessionContext, displayName } from "@/lib/auth";
import { APP } from "@/lib/config";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the BrokerT team.",
};
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const session = await getSessionContext();

  return (
    <Section className="border-t-0">
      <SectionHeading
        eyebrow="Contact"
        title="Talk to us"
        description="Signed-in customers get a tracked support ticket. Everyone else can reach us by email."
      />

      <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Card>
          <CardHeader>
            <CardTitle>Send a message</CardTitle>
          </CardHeader>
          <CardContent>
            {session?.profile ? (
              <ContactForm
                defaultName={displayName(session.profile)}
                defaultEmail={session.profile.email}
              />
            ) : (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  We record messages as support tickets against a customer account, so we can only accept
                  them from signed-in customers — otherwise a message would have nowhere to live and no
                  way for you to follow it up. Sign in, or email us directly.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href="/login?next=/contact">Sign in</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/register">Create an account</Link>
                  </Button>
                  <Button asChild variant="ghost">
                    <a href={`mailto:${APP.supportEmail}`}>
                      <Mail /> Email us
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Other ways to reach us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="flex items-center gap-2">
                <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <a href={`mailto:${APP.supportEmail}`} className="font-medium text-primary hover:underline">
                  {APP.supportEmail}
                </a>
              </p>
              {session?.profile && (
                <p className="flex items-center gap-2">
                  <LifeBuoy className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <Link href="/support" className="font-medium text-primary hover:underline">
                    Your support tickets
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <ShieldAlert className="size-4 text-warning" aria-hidden />
              <CardTitle>Keep yourself safe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <p>
                We will never ask for your password, or any part of it, by email or in a support ticket.
              </p>
              <p>
                We will never ask you to move money to a &quot;safe account&quot; — the platform holds no
                client money and cannot receive a payment.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Not affiliated with Tesla, Inc.</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs leading-relaxed text-muted-foreground">{APP.trademarkNotice}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                We cannot help with vehicle purchases, deliveries, service or warranties. Contact the
                manufacturer or an authorised dealer for those.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Section>
  );
}
