import type { Metadata } from "next";
import { VerifyEmailCard } from "@/features/auth/components/verify-email-card";

export const metadata: Metadata = { title: "Verify email", robots: { index: false } };

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return <VerifyEmailCard tokenPromise={searchParams.then((s) => s.token ?? "")} />;
}
