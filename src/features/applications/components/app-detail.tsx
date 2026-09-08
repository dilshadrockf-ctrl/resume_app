"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Spinner, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import {
  addNoteAction,
  deleteNoteAction,
  updateApplicationAction,
} from "@/features/applications/actions";

type Note = { id: string; body: string; createdAt: Date };

export function AppDetail({
  app,
  jobs,
  letters,
}: {
  app: {
    id: string;
    company: string;
    role: string;
    status: string;
    url: string | null;
    salary: string | null;
    location: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    appliedAt: Date | null;
    followUpAt: Date | null;
    interviewAt: Date | null;
    jobDescriptionId: string | null;
    coverLetterId: string | null;
    notes: Note[];
  };
  jobs: Array<{ id: string; title: string; company: string | null }>;
  letters: Array<{ id: string; company: string; role: string }>;
}) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [f, setF] = React.useState({
    company: app.company,
    role: app.role,
    url: app.url ?? "",
    salary: app.salary ?? "",
    location: app.location ?? "",
    contactName: app.contactName ?? "",
    contactEmail: app.contactEmail ?? "",
    contactPhone: app.contactPhone ?? "",
    appliedAt: app.appliedAt ? app.appliedAt.toISOString().slice(0, 10) : "",
    followUpAt: app.followUpAt ? app.followUpAt.toISOString().slice(0, 10) : "",
    interviewAt: app.interviewAt ? app.interviewAt.toISOString().slice(0, 10) : "",
    jobDescriptionId: app.jobDescriptionId ?? "",
    coverLetterId: app.coverLetterId ?? "",
  });
  const dirty = React.useRef(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF({ ...f, [k]: e.target.value });
    dirty.current = true;
  };
  const save = async () => {
    if (!dirty.current) return;
    dirty.current = false;
    setBusy(true);
    const res = await updateApplicationAction({
      id: app.id,
      company: f.company,
      role: f.role,
      url: f.url || undefined,
      salary: f.salary || undefined,
      location: f.location || undefined,
      contactName: f.contactName || undefined,
      contactEmail: f.contactEmail || undefined,
      contactPhone: f.contactPhone || undefined,
      appliedAt: f.appliedAt || null,
      followUpAt: f.followUpAt || null,
      interviewAt: f.interviewAt || null,
      jobId: f.jobDescriptionId || null,
      coverLetterId: f.coverLetterId || null,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Saved");
      router.refresh();
    } else toast.error(res.error);
  };

  return (
    <div className="grid gap-5">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Company">
            <Input value={f.company} onChange={set("company")} />
          </Field>
          <Field label="Role">
            <Input value={f.role} onChange={set("role")} />
          </Field>
          <Field label="Location">
            <Input value={f.location} onChange={set("location")} />
          </Field>
          <Field label="Salary">
            <Input value={f.salary} onChange={set("salary")} placeholder="$160k–190k" />
          </Field>
          <Field label="Application URL" className="sm:col-span-2">
            <Input value={f.url} onChange={set("url")} placeholder="https://…" />
          </Field>
          <Field label="Applied on">
            <Input type="date" value={f.appliedAt} onChange={set("appliedAt")} />
          </Field>
          <Field label="Follow-up on">
            <Input type="date" value={f.followUpAt} onChange={set("followUpAt")} />
          </Field>
          <Field label="Next interview">
            <Input type="date" value={f.interviewAt} onChange={set("interviewAt")} />
          </Field>
          <Field label="Contact (if known)">
            <Input
              value={f.contactName}
              onChange={set("contactName")}
              placeholder="Dana Lee, Talent"
            />
          </Field>
          <Field label="Contact email">
            <Input value={f.contactEmail} onChange={set("contactEmail")} />
          </Field>
          <Field label="Contact phone">
            <Input value={f.contactPhone} onChange={set("contactPhone")} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Linked job post">
            <select
              value={f.jobDescriptionId}
              onChange={(e) => {
                setF({ ...f, jobDescriptionId: e.target.value });
                dirty.current = true;
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">—</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} · {j.company ?? ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cover letter sent">
            <select
              value={f.coverLetterId}
              onChange={(e) => {
                setF({ ...f, coverLetterId: e.target.value });
                dirty.current = true;
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">—</option>
              {letters.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.role} · {l.company}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? <Spinner /> : null} Save
          </Button>
          {app.url ? (
            <Button type="button" variant="outline" asChild>
              <a href={app.url} target="_blank" rel="noopener noreferrer nofollow">
                Open application ↗
              </a>
            </Button>
          ) : null}
        </div>
      </form>

      <section aria-label="Notes" className="grid gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Notes ({app.notes.length})
        </h2>
        <ul className="grid gap-2" role="list">
          {app.notes.map((n) => (
            <li
              key={n.id}
              className="group flex items-start gap-2 rounded-lg border bg-card px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label="Delete note"
                onClick={async () => {
                  await deleteNoteAction({ noteId: n.id, applicationId: app.id });
                  router.refresh();
                }}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="flex items-start gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!note.trim()) return;
            const res = await addNoteAction({ applicationId: app.id, body: note });
            if (res.ok) {
              setNote("");
              router.refresh();
            } else toast.error(res.error);
          }}
        >
          <Textarea
            rows={2}
            placeholder="Recruiter call took 20 min — next step: technical screen Tuesday…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm" variant="outline" className="mt-0.5">
            <Plus /> Note
          </Button>
        </form>
      </section>
    </div>
  );
}
