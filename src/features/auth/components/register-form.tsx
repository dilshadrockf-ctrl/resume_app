"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginAction, registerAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Field, Input, Spinner } from "@/components/ui/primitives";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    const res = await registerAction({ name, email, password });
    if (!res.ok) {
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
      setBusy(false);
      return;
    }
    // sign the new user in immediately — first value fast (§133)
    const login = await loginAction({ email: res.data.email, password, redirectTo: "/dashboard" });
    if (login.ok) router.push("/dashboard");
    else router.push("/login");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h1 className="text-lg font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Free while self-hosted. No credit card, no cloud lock-in.
        </p>
        <form onSubmit={onSubmit} className="mt-6 grid gap-4" noValidate>
          <Field label="Full name" htmlFor="name" error={fieldErrors.name}>
            <Input
              id="name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Email" htmlFor="email" error={fieldErrors.email}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field
            label="Password"
            htmlFor="password"
            error={fieldErrors.password}
            hint="At least 10 characters."
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={busy} className="mt-1">
            {busy ? <Spinner /> : null} Create account
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
