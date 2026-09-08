import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetForm } from "@/features/auth/components/reset-form";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
