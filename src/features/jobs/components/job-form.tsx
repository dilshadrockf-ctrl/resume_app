"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { createJobAction } from "@/features/jobs/actions";

export function JobForm({
  resumes,
  defaults,
}: {
  resumes: Array<{ id: string; name: string }>;
  defaults?: { title?: string; company?: string; text?: string; url?: string };
}) {
  const router = useRouter();
  const [v, setV] = React.useState({
    title: defaults?.title ?? "",
    company: defaults?.company ?? "",
    location: "",
    url: defaults?.url ?? "",
    salary: "",
    text: defaults?.text ?? "",
  });
  const [busy, setBusy] = React.useState(false);

  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await createJobAction({ ...v, url: v.url || undefined });
        setBusy(false);
        if (!res.ok) {
          toast.error(res.error, { description: res.fieldErrors?.text });
          return;
        }
        toast.success("Saved — run a match to see coverage.");
        router.refresh();
        router.push(`/jobs/${res.data.jobId}`);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role">
          <Input
            required
            value={v.title}
            onChange={(e) => setV({ ...v, title: e.target.value })}
            placeholder="Senior Platform Engineer"
          />
        </Field>
        <Field label="Company">
          <Input value={v.company} onChange={(e) => setV({ ...v, company: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Location">
          <Input
            value={v.location}
            onChange={(e) => setV({ ...v, location: e.target.value })}
            placeholder="Remote"
          />
        </Field>
        <Field label="Salary">
          <Input
            value={v.salary}
            onChange={(e) => setV({ ...v, salary: e.target.value })}
            placeholder="$160k–190k"
          />
        </Field>
      </div>
      <Field label="Posting URL">
        <Input
          type="url"
          value={v.url}
          onChange={(e) => setV({ ...v, url: e.target.value })}
          placeholder="https://…"
        />
      </Field>
      <Field
        label="Full job text"
        hint="Paste the whole posting — requirements + responsibilities. Kept verbatim for later."
      >
        <Textarea
          rows={10}
          required
          value={v.text}
          onChange={(e) => setV({ ...v, text: e.target.value })}
        />
      </Field>
      <Button type="submit" disabled={busy} className="justify-center">
        {busy ? <Spinner /> : null} Save &amp; extract keywords
      </Button>
    </form>
  );
}
