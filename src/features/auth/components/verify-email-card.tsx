"use client";
import * as React from "react";
import Link from "next/link";
import { verifyEmailAction } from "@/features/auth/actions";
import { Card, CardContent, Spinner } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

type State = { kind: "busy" } | { kind: "done"; email: string } | { kind: "error"; message: string };

export function VerifyEmailCard({ tokenPromise }: { tokenPromise: Promise<string> }) {
  const [state, setState] = React.useState<State>({ kind: "busy" });

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      const token = await tokenPromise;
      if (!token) {
        setState({ kind: "error", message: "This link is missing its verification token." });
        return;
      }
      const res = await verifyEmailAction({ token });
      if (!alive) return;
      if (res.ok) setState({ kind: "done", email: res.data.email });
      else setState({ kind: "error", message: res.error });
    })();
    return () => {
      alive = false;
    };
  }, [tokenPromise]);

  return (
    <Card>
      <CardContent className="grid justify-items-center gap-3 p-8 text-center">
        {state.kind === "busy" ? (
          <>
            <Spinner className="size-6 text-primary" />
            <p className="text-sm text-muted-foreground">Verifying your email…</p>
          </>
        ) : state.kind === "done" ? (
          <>
            <div className="flex size-11 items-center justify-center rounded-full bg-success/15 text-success">✓</div>
            <h1 className="text-lg font-semibold">Email verified</h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{state.email}</span> is confirmed. Account recovery is now available.
            </p>
            <Link href="/dashboard">
              <Button className="mt-1">Go to dashboard</Button>
            </Link>
          </>
        ) : (
          <>
            <div className="flex size-11 items-center justify-center rounded-full bg-destructive/15 text-destructive">!</div>
            <h1 className="text-lg font-semibold">Could not verify</h1>
            <p className="text-sm text-muted-foreground">{state.message}</p>
            <Link href="/login">
              <Button variant="outline" className="mt-1">Back to sign in</Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
