"use client";

import { AuthenticateWithRedirectCallback, useClerk } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SsoCallbackPage() {
  const clerk = useClerk();
  const searchParams = useSearchParams();
  const [emailLinkHandled, setEmailLinkHandled] = useState(false);
  const [emailLinkError, setEmailLinkError] = useState<string | null>(null);

  const hasEmailLinkTicket = searchParams.has("__clerk_ticket");

  useEffect(() => {
    if (!hasEmailLinkTicket) return;

    let cancelled = false;
    clerk
      .handleEmailLinkVerification({
        redirectUrlComplete: "/workspace",
        redirectUrl: "/sign-in",
        onVerifiedOnOtherDevice: () => {
          if (!cancelled) {
            setEmailLinkHandled(true);
          }
        },
      })
      .then(() => {
        if (!cancelled) {
          setEmailLinkHandled(true);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to complete email link verification.";
          setEmailLinkError(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clerk, hasEmailLinkTicket]);

  if (hasEmailLinkTicket) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08080b] px-6 text-zinc-100">
        <div className="w-full max-w-sm rounded-3xl border border-white/8 bg-white/[0.03] p-6 text-center">
          <p className="text-sm font-medium text-zinc-100">
            {emailLinkError ? "Magic link verification failed." : emailLinkHandled ? "Magic link verified." : "Verifying magic link..."}
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {emailLinkError ?? "You can close this tab after the flow completes."}
          </p>
        </div>
      </div>
    );
  }

  return <AuthenticateWithRedirectCallback />;
}
