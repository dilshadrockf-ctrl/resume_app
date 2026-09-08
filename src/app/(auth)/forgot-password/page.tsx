import type { Metadata } from "next";
import { ForgotForm } from "@/features/auth/components/forgot-form";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
