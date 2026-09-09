"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { createLetterAction } from "@/features/coverletters/actions";

export function NewLetterDialog({
  resumes,
  jobs,
}: {
  resumes: Array<{ id: string; name: string }>;
  jobs: Array<{ id: string; title: string; company: string | null }>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [v, setV] = React.useState({
    company: "",
    role: "",
    hiringManager: "",
    resumeId: "",
    jobId: "",
    tone: "PROFESSIONAL",
    length: "STANDARD",
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New letter
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start a cover letter</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!v.company.trim() || !v.role.trim()) {
              toast.error("Company and role are required.");
              return;
            }
            setBusy(true);
            const res = await createLetterAction({
              company: v.company,
              role: v.role,
              hiringManager: v.hiringManager || undefined,
              resumeId: v.resumeId || undefined,
              jobId: v.jobId || undefined,
              tone: v.tone as never,
              length: v.length as never,
            });
            setBusy(false);
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            setOpen(false);
            router.push(`/cover-letters/${res.data.id}`);
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company">
              <Input
                required
                value={v.company}
                onChange={(e) => setV({ ...v, company: e.target.value })}
              />
            </Field>
            <Field label="Role">
              <Input
                required
                value={v.role}
                onChange={(e) => setV({ ...v, role: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Hiring manager" hint="optional — “Hiring Manager” is used if unknown">
            <Input
              value={v.hiringManager}
              onChange={(e) => setV({ ...v, hiringManager: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pull facts from resume">
              <Select
                value={v.resumeId || undefined}
                onValueChange={(x) => setV({ ...v, resumeId: x ?? "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a resume" />
                </SelectTrigger>
                <SelectContent>
                  {resumes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="For job posting">
              <Select
                value={v.jobId || undefined}
                onValueChange={(x) => setV({ ...v, jobId: x ?? "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.title} · {j.company ?? ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tone">
              <Select value={v.tone} onValueChange={(x) => setV({ ...v, tone: x ?? v.tone })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "PROFESSIONAL",
                    "CONCISE",
                    "TRADITIONAL",
                    "TECHNICAL",
                    "EXECUTIVE",
                    "FRIENDLY",
                  ].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Length">
              <Select value={v.length} onValueChange={(x) => setV({ ...v, length: x ?? v.length })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["SHORT", "STANDARD", "DETAILED"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            The scaffold only reuses bullets already on the resume and leaves [PLACEHOLDERS] for the
            rest — nothing is invented for you.
          </p>
          <Button type="submit" disabled={busy} className="justify-center">
            {busy ? <Spinner /> : null} Generate scaffold
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
