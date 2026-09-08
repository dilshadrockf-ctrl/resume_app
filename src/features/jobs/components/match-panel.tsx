"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ShieldQuestion, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Spinner,
} from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  matchJobAction,
  applyRecommendationAction,
  dismissRecommendationAction,
  createTailoredVersionAction,
} from "@/features/jobs/actions";

type Breakdown = {
  keywordCoverage: {
    earned: number;
    possible: number;
    matched: string[];
    missing: string[];
    requiredMissing: string[];
  };
  titleAlignment: { overlap: number; note: string };
  structureFit: { present: string[]; suggested: string[] };
  recency: { note: string };
};

type Match = {
  id: string;
  score: number;
  resumeId: string;
  resumeName: string;
  versionId: string;
  createdAt: string;
  status: string;
  breakdown: Breakdown | null;
  recommendations: Array<{
    id: string;
    action: string;
    rationale: string | null;
    status: string;
    suggested: string | null;
  }>;
};

export function MatchPanel({
  jobId,
  resumes,
  matches,
}: {
  jobId: string;
  resumes: Array<{ id: string; name: string }>;
  matches: Match[];
}) {
  const router = useRouter();
  const [resumeId, setResumeId] = React.useState(resumes[0]?.id ?? "");
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState<string | null>(matches[0]?.id ?? null);

  async function runMatch() {
    if (!resumeId) {
      toast.error("Create a resume first — matching needs something to score.");
      return;
    }
    setBusy(true);
    const res = await matchJobAction({ jobId, resumeId });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Match scored — breakdown is factual, term by term.");
    router.refresh();
  }

  return (
    <div className="grid content-start gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm">Run a match</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Resume</span>
            <select
              value={resumeId}
              onChange={(e) => setResumeId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={runMatch} disabled={busy || resumes.length === 0}>
            {busy ? <Spinner /> : <Sparkles />} Score match
          </Button>
        </CardContent>
      </Card>

      {matches.length === 0 ? (
        <EmptyState
          icon={<ShieldQuestion aria-hidden />}
          title="No matches yet"
          description="Scoring is local: keyword coverage (50%), title alignment (20%), structure fit (20%), extras (10%). Every term counted is shown below the score — no black box, no ATS guarantees."
        />
      ) : (
        matches.map((m) => {
          const b = m.breakdown;
          const isOpen = open === m.id;
          const pending = m.recommendations.filter((r) => r.status === "PENDING");
          return (
            <Card key={m.id}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : m.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {m.resumeName}{" "}
                    <Badge
                      variant={m.score >= 70 ? "success" : m.score >= 45 ? "warning" : "muted"}
                    >
                      {m.score}%
                    </Badge>
                    {pending.length > 0 ? (
                      <Badge variant="secondary" className="ml-2">
                        {pending.length} suggestion{pending.length > 1 ? "s" : ""}
                      </Badge>
                    ) : null}
                  </p>
                  <div
                    className="mt-1.5 h-1.5 max-w-xs overflow-hidden rounded-full bg-muted"
                    aria-label={`Match ${m.score}%`}
                    role="img"
                  >
                    <div
                      className={cn(
                        "h-full rounded-full",
                        m.score >= 70
                          ? "bg-emerald-500"
                          : m.score >= 45
                            ? "bg-amber-500"
                            : "bg-rose-500",
                      )}
                      style={{ width: `${m.score}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(m.createdAt).toLocaleDateString()} {isOpen ? "▲" : "▼"}
                </span>
              </button>
              {isOpen && b ? (
                <CardContent className="grid gap-4 border-t pt-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      {
                        label: "Keywords (65%)",
                        v: b.keywordCoverage.possible
                          ? Math.round(
                              (b.keywordCoverage.earned / b.keywordCoverage.possible) * 100,
                            )
                          : 100,
                        d: `${b.keywordCoverage.matched.length}/${b.keywordCoverage.matched.length + b.keywordCoverage.missing.length} weighted terms covered`,
                      },
                      {
                        label: "Title align (20%)",
                        v:
                          b.titleAlignment.overlap > 0
                            ? Math.min(100, b.titleAlignment.overlap * 34)
                            : 0,
                        d: b.titleAlignment.note,
                      },
                      {
                        label: "Structure (15%)",
                        v: b.structureFit.suggested.length === 0 ? 100 : 40,
                        d: b.structureFit.suggested.length
                          ? `consider adding: ${b.structureFit.suggested.join(", ").toLowerCase()}`
                          : "all wanted sections present",
                      },
                    ].map((x) => (
                      <div key={x.label} className="rounded-lg border p-2">
                        <p className="text-lg font-semibold tabular-nums">{Math.round(x.v)}%</p>
                        <p className="text-[11px] font-medium">{x.label}</p>
                        <p className="text-[10px] text-muted-foreground">{x.d}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-1.5 text-xs">
                    <p>
                      <span className="font-medium">
                        Matched ({b.keywordCoverage.matched.length}):
                      </span>{" "}
                      {b.keywordCoverage.matched.slice(0, 14).map((t) => (
                        <Badge key={t} variant="success" className="mr-1 mb-1">
                          {t}
                        </Badge>
                      ))}
                    </p>
                    {b.keywordCoverage.requiredMissing.length ? (
                      <p>
                        <span className="font-medium">Missing from stated requirements:</span>{" "}
                        {b.keywordCoverage.requiredMissing.map((t) => (
                          <Badge key={t} variant="destructive" className="mr-1 mb-1">
                            {t}
                          </Badge>
                        ))}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground">{b.recency.note}</p>
                  </div>
                  {pending.length > 0 ? (
                    <div className="grid gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Suggestions (factual only — never invented)
                      </p>
                      {pending.map((r) => (
                        <div key={r.id} className="rounded-lg border p-3">
                          <p className="text-xs">{r.rationale}</p>
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                const res = await applyRecommendationAction({
                                  recommendationId: r.id,
                                });
                                if (!res.ok)
                                  toast.error(res.error, {
                                    description:
                                      "Only changes already supported by your profile can auto-apply.",
                                  });
                                else {
                                  toast.success(
                                    `Applied — ${res.data.applied}. A new version was recorded.`,
                                  );
                                  router.refresh();
                                }
                              }}
                            >
                              <Check /> Apply
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                await dismissRecommendationAction({ recommendationId: r.id });
                                router.refresh();
                              }}
                            >
                              <X /> Skip
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const res = await createTailoredVersionAction({
                          jobId,
                          resumeId: m.resumeId,
                        });
                        if (res.ok)
                          toast.success("Current state snapshotted and linked to this job.");
                        else toast.error(res.error);
                      }}
                    >
                      Save current state as “for this job” version
                    </Button>
                  </div>
                </CardContent>
              ) : null}
            </Card>
          );
        })
      )}
    </div>
  );
}
