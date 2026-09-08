"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPasswordAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Field, Input, Spinner } from "@/components/ui/primitives";

export function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await resetPasswordAction({ token, password });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push("/login?reset=1");
    router.refresh();
  }

  if (!token) {
    return (
      <Card>
        <CardContent className="p-6 text-sm">
          <p className="text-destructive">This reset link is missing its token.</p>
          <Link className="mt-3 inline-block font-medium text-primary hover:underline" href="/forgot-password">
            Request a new link
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h1 className="text-lg font-semibold">Choose a new password</h1>
        <form onSubmit={onSubmit} className="mt-6 grid gap-4" noValidate>
          <Field label="New password" htmlFor="pw" hint="At least 10 characters.">
            <Input id="pw" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm new password" htmlFor="pw2">
            <Input id="pw2" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={busy}>
            {busy ? <Spinner /> : null} Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
