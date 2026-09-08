"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import { Card, CardContent } from "@/components/ui/primitives";
import { Spinner } from "@/components/ui/primitives";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const next = params.get("next") ?? "/dashboard";
    const res = await loginAction({ email, password, redirectTo: next.startsWith("/") ? next : "/dashboard" });
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.push(res.data.redirectTo);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h1 className="text-lg font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to keep editing your resumes.</p>
        <form onSubmit={onSubmit} className="mt-6 grid gap-4" noValidate>
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error ? (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={busy} className="mt-1">
            {busy ? <Spinner /> : null} Sign in
          </Button>
        </form>
        <div className="mt-5 flex items-center justify-between text-sm">
          <Link className="text-muted-foreground underline-offset-4 hover:underline" href="/forgot-password">
            Forgot password?
          </Link>
          <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/register">
            Create account
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
