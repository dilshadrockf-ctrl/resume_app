"use client";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Copy, Info, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";
import {
  getAnalysisAction,
  runAnalysisNowAction,
  type AnalysisDto,
} from "@/features/resume/analysis-actions";

const LABELS: Record<string, string> = {
  contact: "Contact",
  summary: "Summary",
  experience: "Experience",
  skills: "Skills",
  structure: "Structure",
  length: "Length",
};

export function AnalysisDialog({
  open,
  onOpenChange,
  resumeId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  resumeId: string;
}) {
  const [data, setData] = useState<AnalysisDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(
    async (run: boolean) => {
      setBusy(true);
      try {
        const fn = run ? runAnalysisNowAction : getAnalysisAction;
        const res = await fn({ resumeId });
        if (res.ok) setData(res.data);
      } finally {
        setBusy(false);
      }
    },
    [resumeId],
  );
  useEffect(() => {
    if (open) void load(false);
  }, [open, load]);

  const bySeverity = { high: 0, medium: 0, low: 0 };
  for (const i of data?.issues ?? []) bySeverity[i.severity]++;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>ATS analysis</DialogTitle>
          <DialogDescription>
            Deterministic checks on the latest saved version — no AI, nothing leaves this machine.
            Rules engine {data?.engineVersion ?? "…"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto py-1">
          {busy && !data ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
            </div>
          ) : null}
          {data ? (
            <>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tabular-nums">{data.score}</span>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                </div>
                <div className="grid flex-1 min-w-64 grid-cols-3 gap-2 sm:grid-cols-6">
                  {Object.entries(data.breakdown).map(([k, v]) => (
                    <div
                      key={k}
                      title={v.note}
                      className="rounded border border-border p-1.5 text-center"
                    >
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {LABELS[k] ?? k}
                      </div>
                      <div className="text-xs font-medium tabular-nums">
                        {v.earned}/{v.possible}
                      </div>
                      <div className="mt-1 h-1 rounded bg-muted">
                        <div
                          className="h-1 rounded bg-primary"
                          style={{ width: `${(v.earned / v.possible) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Analyzed against “{data.versionLabel}” ·{" "}
                {new Date(data.analyzedAt).toLocaleString()}
                {bySeverity.high > 0
                  ? ` · ${bySeverity.high} high · ${bySeverity.medium} medium · ${bySeverity.low} minor`
                  : bySeverity.medium > 0
                    ? ` · ${bySeverity.medium} worth fixing`
                    : " · nothing flagged"}
              </p>
              {data.issues.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No issues found by the current ruleset.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.issues.map((issue, i) => (
                    <li key={`${issue.code}-${i}`} className="rounded border border-border p-3">
                      <div className="flex items-start gap-2">
                        {issue.severity === "low" ? (
                          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <AlertTriangle
                            className={`mt-0.5 h-4 w-4 shrink-0 ${issue.severity === "high" ? "text-red-500" : "text-amber-500"}`}
                          />
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-sm font-medium leading-snug">{issue.message}</p>
                          <p className="text-xs text-muted-foreground">{issue.fix}</p>
                          {issue.evidence ? (
                            <p className="truncate font-mono text-[11px] text-muted-foreground/80">
                              “{issue.evidence}”
                            </p>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          title="Copy the fix suggestion"
                          onClick={() => {
                            void navigator.clipboard?.writeText(`${issue.message}\n${issue.fix}`);
                            setCopied(`${issue.code}-${i}`);
                            window.setTimeout(() => setCopied(null), 1500);
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copied === `${issue.code}-${i}` ? "Copied" : ""}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => load(true)}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}{" "}
            Re-run now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
