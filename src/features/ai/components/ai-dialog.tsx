"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge, Field, Spinner, Textarea } from "@/components/ui/primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { Sparkles, X } from "lucide-react";
import {
  aiSuggestAction,
  aiOutcomeAction,
  aiStatusAction,
  recentAiAction,
  aiJobsAction,
  type Suggestion,
} from "@/features/ai/actions";

// native select — same style used elsewhere in the editor
function Sel(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
    />
  );
}

type SectionLite = { kind: string; title: string; items: number[]; summaryText?: string };

export function AiDialog({
  open,
  onClose,
  resumeId,
  sections,
  apply,
}: {
  open: boolean;
  onClose: () => void;
  resumeId: string;
  sections: SectionLite[];
  apply: (s: Suggestion) => void;
}) {
  const [status, setStatus] = React.useState<{
    configured: boolean;
    provider: string;
    model: string | null;
    note: string;
  } | null>(null);
  const [jobs, setJobs] = React.useState<Array<{ id: string; title: string }>>([]);
  const [recent, setRecent] = React.useState<
    Array<{ action: string; provider: string; model: string; status: string; createdAt: string }>
  >([]);
  const [sel, setSel] = React.useState({
    sectionKind: "EXPERIENCE",
    itemIndex: 0,
    intent: "tighten" as "tighten" | "action-verbs" | "align-job",
    jobId: "",
  });
  const [busy, setBusy] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState<Suggestion | null>(null);
  const [suggested, setSuggested] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    void aiStatusAction().then((r) => r.ok && setStatus(r.data));
    void aiJobsAction().then((r) => r.ok && setJobs(r.data));
    void recentAiAction().then((r) => r.ok && setRecent(r.data));
  }, [open]);

  const currentSection = sections.find((s) => s.kind === sel.sectionKind) ?? sections[0];
  const sectionItems =
    currentSection && currentSection.kind !== "SUMMARY" ? currentSection.items : [0];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" /> AI suggestions — review only
          </DialogTitle>
          <DialogDescription>
            Nothing is ever written for you automatically. The original stays visible until you
            accept.
          </DialogDescription>
        </DialogHeader>

        {status === null ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : !status.configured ? (
          <div className="grid gap-3 py-4 text-sm">
            <p className="rounded-lg border border-dashed p-4 text-muted-foreground">
              {status.note}
            </p>
            <p className="text-xs text-muted-foreground">
              Works fully offline with Ollama: run{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono">
                ollama serve && ollama pull llama3.1
              </code>
              , then set{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono">AI_PROVIDER=ollama</code> and{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono">
                AI_BASE_URL=http://127.0.0.1:11434/v1
              </code>
              .
            </p>
            {recent.length > 0 ? (
              <ul className="grid gap-1 text-xs text-muted-foreground">
                {recent.map((r, i) => (
                  <li key={i}>
                    {r.action} · {r.provider}/{r.model} · {r.status.toLowerCase()} ·{" "}
                    {new Date(r.createdAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : suggestion ? (
          <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Your original
                </p>
                <Textarea
                  readOnly
                  rows={8}
                  value={suggestion.original}
                  className="bg-muted/40 text-[13px]"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Suggested ({status.provider}) — editable
                </p>
                <Textarea
                  rows={8}
                  value={suggested}
                  onChange={(e) => setSuggested(e.target.value)}
                  className="text-[13px]"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Guardrail active: the provider may only reuse facts from your text; anything that
              inflates the content is blocked server-side.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await aiOutcomeAction({
                    recommendationId: suggestion.recommendationId,
                    outcome: "REJECTED",
                  });
                  setSuggestion(null);
                  setError(null);
                  toast.info("Discarded — your text was never touched.");
                }}
              >
                <X /> Discard
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  apply({ ...suggestion, suggested });
                  await aiOutcomeAction({
                    recommendationId: suggestion.recommendationId,
                    outcome: "ACCEPTED",
                    finalText: suggested,
                  });
                  setSuggestion(null);
                  toast.success(
                    "Applied to your draft (marked unsaved). Autosave will version it.",
                  );
                }}
              >
                Accept into draft
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              const res = await aiSuggestAction({
                resumeId,
                sectionKind: sel.sectionKind as never,
                itemIndex: sel.itemIndex,
                intent: sel.intent,
                jobDescriptionId: sel.intent === "align-job" ? sel.jobId || undefined : undefined,
              });
              setBusy(false);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setSuggestion(res.data);
              setSuggested(res.data.suggested);
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Section">
                <Sel
                  value={sel.sectionKind}
                  onChange={(e) => setSel({ ...sel, sectionKind: e.target.value, itemIndex: 0 })}
                >
                  {sections.map((s) => (
                    <option key={s.kind} value={s.kind}>
                      {s.title}
                      {s.kind === "SUMMARY" ? " (whole summary)" : ""}
                    </option>
                  ))}
                </Sel>
              </Field>
              <Field label={currentSection?.kind === "SUMMARY" ? "—" : "Entry"}>
                <Sel
                  value={sel.itemIndex}
                  onChange={(e) => setSel({ ...sel, itemIndex: Number(e.target.value) })}
                  disabled={currentSection?.kind === "SUMMARY"}
                >
                  {sectionItems.map((i) => (
                    <option key={i} value={i}>
                      #{i + 1}
                    </option>
                  ))}
                </Sel>
              </Field>
              <Field label="Task">
                <Sel
                  value={sel.intent}
                  onChange={(e) => setSel({ ...sel, intent: e.target.value as never })}
                >
                  <option value="tighten">Tighten wording (cut fluff)</option>
                  <option value="action-verbs">Stronger action verbs</option>
                  <option value="align-job">Align emphasis to a saved job</option>
                </Sel>
              </Field>
              {sel.intent === "align-job" ? (
                <Field label="Job">
                  <Sel
                    value={sel.jobId}
                    onChange={(e) => setSel({ ...sel, jobId: e.target.value })}
                  >
                    {jobs.length === 0 ? <option value="">no saved jobs yet</option> : null}
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                      </option>
                    ))}
                  </Sel>
                </Field>
              ) : (
                <div />
              )}
            </div>
            {error ? (
              <p className="rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-xs text-rose-600">
                {error}
              </p>
            ) : null}
            <div className="flex items-center justify-between">
              <Badge variant="muted">
                {status.provider}/{status.model ?? "default"}
              </Badge>
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? <Spinner /> : <Sparkles />} Draft a suggestion
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
