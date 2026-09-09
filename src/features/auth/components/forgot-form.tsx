"use client";
import * as React from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Field, Input, Spinner } from "@/components/ui/primitives";

export function ForgotForm() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await forgotPasswordAction({ email });
    setBusy(false);
    if (!res.ok) setError(res.error);
    else setSent(true);
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h1 className="text-lg font-semibold">Reset your password</h1>
        {sent ? (
          <div className="mt-4 space-y-3 text-sm">
            <p className="rounded-md bg-success/10 px-3 py-2 text-success dark:bg-emerald-500/10">
              If an account exists for <span className="font-medium">{email}</span>, a reset link is
              on its way.
            </p>
            <p className="text-muted-foreground">
              Running locally without SMTP? The link is printed in the server log (and in Mailpit at
              <code className="mx-1 rounded bg-muted px-1">http://localhost:8025</code> when
              configured).
            </p>
            <Link href="/login" className="inline-block font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              We&apos;ll email you a secure one-time link.
            </p>
            <form onSubmit={onSubmit} className="mt-6 grid gap-4" noValidate>
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={busy}>
                {busy ? <Spinner /> : null} Send reset link
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link href="/login" className="hover:underline">
                  Remembered it? Sign in
                </Link>
              </p>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
