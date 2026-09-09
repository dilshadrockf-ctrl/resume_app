"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/overlays";
import { Field, Input, Spinner } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { createApplicationAction } from "@/features/applications/actions";

export function NewAppDialog({
  jobs,
  letters,
}: {
  jobs: Array<{ id: string; title: string; company: string | null }>;
  letters: Array<{ id: string; company: string; role: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [v, setV] = React.useState({ company: "", role: "", url: "", jobId: "", letterId: "" });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Track an application
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Track an application</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const res = await createApplicationAction({
              company: v.company,
              role: v.role,
              url: v.url || undefined,
              jobId: v.jobId || null,
              coverLetterId: v.letterId || null,
              status: "SAVED",
            });
            setBusy(false);
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            setOpen(false);
            router.push(`/applications/${res.data.id}`);
          }}
        >
          <Field label="Company">
            <Input
              required
              value={v.company}
              onChange={(e) => setV({ ...v, company: e.target.value })}
            />
          </Field>
          <Field label="Role">
            <Input required value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })} />
          </Field>
          <Field label="Application URL" hint="optional — used for the one-click open in new tab">
            <Input
              type="url"
              value={v.url}
              onChange={(e) => setV({ ...v, url: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          <div className="grid gap-1.5 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!v.jobId}
                onChange={(e) => setV({ ...v, jobId: e.target.checked ? (jobs[0]?.id ?? "") : "" })}
                className="size-4 accent-primary"
              />
              Link to a saved job{" "}
              {jobs.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  (none yet —{" "}
                  <Link className="underline" href="/jobs">
                    add one
                  </Link>
                  )
                </span>
              ) : null}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!v.letterId}
                onChange={(e) =>
                  setV({ ...v, letterId: e.target.checked ? (letters[0]?.id ?? "") : "" })
                }
                className="size-4 accent-primary"
              />
              Link a cover letter{" "}
              {letters.length === 0 ? (
                <span className="text-xs text-muted-foreground">(none yet)</span>
              ) : null}
            </label>
          </div>
          <Button type="submit" disabled={busy} className="justify-center">
            {busy ? <Spinner /> : null} Start tracking
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
