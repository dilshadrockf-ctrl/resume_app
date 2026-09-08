"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Spinner, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { saveProfileAction, saveSummaryAction } from "@/features/profile/actions";

type Values = Record<string, string> & {
  displayName: string; headline: string; email: string; phone: string; location: string;
  website: string; linkedin: string; github: string; targetRole: string; industry: string;
};

export function ProfileContactCard({ initial, summary }: { initial: Values; summary: string }) {
  const router = useRouter();
  const [v, setV] = React.useState<Values>(initial);
  const [s, setS] = React.useState(summary);
  const [busy, setBusy] = React.useState(false);

  const fields: Array<[keyof Values, string, string]> = [
    ["displayName", "Full name", ""], ["headline", "Headline", "Senior Platform Engineer"],
    ["email", "Email", ""], ["phone", "Phone", ""],
    ["location", "Location", "City, State"], ["website", "Website", "yoursite.dev"],
    ["linkedin", "LinkedIn", "linkedin.com/in/you"], ["github", "GitHub", "github.com/you"],
    ["targetRole", "Target role", ""], ["industry", "Industry", ""],
  ];

  async function save() {
    setBusy(true);
    const [p, q] = await Promise.all([saveProfileAction(v), saveSummaryAction({ summary: s })]);
    setBusy(false);
    if (!p.ok || !q.ok) toast.error((!p.ok ? p.error : (!q.ok ? q.error : "")) ?? "Save failed");
    else {
      toast.success("Profile saved — open resumes refresh on next edit");
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact & focus</CardTitle>
        <CardDescription>Printed on every resume. Only fields you fill are shown on documents.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map(([key, label, placeholder]) => (
            <Field key={key} label={label}>
              <Input value={v[key] ?? ""} placeholder={placeholder} onChange={(e) => setV((prev) => ({ ...prev, [key]: e.target.value }))} />
            </Field>
          ))}
        </div>
        <Field label="Professional summary" hint="2–4 sentences. Facts only — the AI assistant can polish wording, never invent history.">
          <Textarea rows={4} value={s} onChange={(e) => setS(e.target.value)} />
        </Field>
        <div className="flex justify-end">
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? <Spinner className="size-4 animate-spin" /> : <Save className="size-4" />} Save profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
