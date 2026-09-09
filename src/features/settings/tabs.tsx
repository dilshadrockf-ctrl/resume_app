"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock4, Download, MailCheck, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Spinner,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { queueDataExportAction, queuedDataExportsAction } from "@/features/account/actions";
import {
  changePasswordAction,
  deleteAccountAction,
  logoutAction,
  resendVerificationAction,
} from "@/features/auth/actions";

export function SettingsAccountTabs({
  user,
  aiConfigured,
}: {
  user: { email: string; name: string | null; verified: boolean; since: string };
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [pw, setPw] = React.useState({ current: "", next: "", confirm: "" });
  const [pwErr, setPwErr] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleteText, setDeleteText] = React.useState("");

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>
            Signed in as {user.email} · member since {new Date(user.since).toLocaleDateString()} ·
            AI {aiConfigured ? "configured" : "off (everything still works)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {!user.verified ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const res = await resendVerificationAction();
                setBusy(false);
                if (res.ok)
                  toast.success("Verification email sent (printed to the server log locally).");
                else toast.error(res.error);
              }}
            >
              <MailCheck /> Send verification email
            </Button>
          ) : (
            <Badge variant="success" className="self-center">
              <ShieldCheck className="size-3" /> Email verified
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid max-w-sm gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (pw.next !== pw.confirm) {
                setPwErr("New passwords don't match.");
                return;
              }
              setBusy(true);
              setPwErr(null);
              const res = await changePasswordAction({ current: pw.current, next: pw.next });
              setBusy(false);
              if (!res.ok) setPwErr(res.error);
              else {
                setPw({ current: "", next: "", confirm: "" });
                toast.success("Password changed. Other devices were signed out.");
              }
            }}
          >
            <Field label="Current password">
              <Input
                type="password"
                autoComplete="current-password"
                value={pw.current}
                onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                required
              />
            </Field>
            <Field label="New password" hint="10+ characters.">
              <Input
                type="password"
                autoComplete="new-password"
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                required
              />
            </Field>
            <Field label="Confirm new password" error={pwErr ?? undefined}>
              <Input
                type="password"
                autoComplete="new-password"
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                required
              />
            </Field>
            <Button type="submit" className="justify-self-start" disabled={busy}>
              {busy ? <Spinner /> : null} Update password
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your data</CardTitle>
          <CardDescription>
            Self-hosted means yours: download everything as JSON, or delete the account for real.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/account/data" download>
              <Download /> Export all my data (JSON)
            </a>
          </Button>
          <span className="text-xs text-muted-foreground">
            Resumes, profile, applications, letters, history.
          </span>
          <QueuedExport />
          <span className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => void logoutAction()}>
            Sign out
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Delete account</CardTitle>
          <CardDescription>
            Removes profile, resumes, exports and history — this cannot be undone. Back up via the
            JSON export first.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button
            variant="destructive"
            size="sm"
            className="justify-self-start"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 /> Delete my account
          </Button>
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            destructive
            title="Delete account permanently?"
            confirmLabel="Delete everything"
            body={
              <div className="grid gap-2">
                <p>
                  Type DELETE to confirm. All resumes, career history, jobs, applications and
                  exports for {user.email} are removed. Your current password is required (enter it
                  in the form above first).
                </p>
                <Input
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder="DELETE"
                  aria-label="Type DELETE to confirm"
                />
              </div>
            }
            onConfirm={async () => {
              if (deleteText !== "DELETE") {
                toast.error("Type DELETE to confirm");
                return;
              }
              const res = await deleteAccountAction({ password: pw.current });
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success("Account deleted. Goodbye — and good luck out there.");
              router.push("/");
              router.refresh();
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

/** Server-side (queued) copy of the same JSON — runs as a job; for big
 *  profiles or grabbing it later. The direct download above stays the default. */
function QueuedExport() {
  const [busy, setBusy] = React.useState(false);
  type ExportRow = {
    id: string;
    status: string;
    bytes: number | null;
    createdAt: string;
    fileName: string;
  };
  const [rows, setRows] = React.useState<ExportRow[] | null>(null);
  const run = async () => {
    setBusy(true);
    try {
      const res = await queueDataExportAction();
      if (res.ok) {
        setTimeout(() => void refresh(), 600);
      } else toast.error(res.error ?? "Could not queue export.");
    } finally {
      setBusy(false);
    }
  };
  const refresh = async () => {
    const res = await queuedDataExportsAction();
    if (res.ok) setRows(res.data);
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={run} disabled={busy}>
        {busy ? <Spinner /> : <Clock4 />} Queue server-side copy
      </Button>
      {rows?.[0] ? (
        <span className="text-xs text-muted-foreground">
          latest:{" "}
          {rows[0].status === "READY" ? (
            <a className="underline" href={`/api/files/exports/${rows[0].id}`} download>
              download ({(rows[0].bytes ?? 0) >> 10} KB)
            </a>
          ) : (
            rows[0].status.toLowerCase()
          )}
        </span>
      ) : null}
      {rows ? (
        <Button variant="ghost" size="sm" onClick={refresh}>
          Refresh
        </Button>
      ) : null}
    </span>
  );
}
