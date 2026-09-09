"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { deleteJobAction } from "@/features/jobs/actions";
import { timeAgo } from "@/lib/utils";

export function JobRow({
  job,
}: {
  job: {
    id: string;
    title: string;
    company: string | null;
    location: string | null;
    createdAt: Date;
    bestMatch: { score: number; resumeId: string | null; resumeName: string } | null;
    applications: Array<{ id: string; status: string }>;
  };
}) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState(false);
  return (
    <li>
      <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <Link href={`/jobs/${job.id}`} className="truncate text-sm font-medium hover:underline">
            {job.title}
          </Link>
          <p className="text-xs text-muted-foreground">
            {job.company ?? "—"}
            {job.location ? ` · ${job.location}` : ""} · saved {timeAgo(job.createdAt)}
          </p>
        </div>
        {job.bestMatch ? (
          <Link href={`/jobs/${job.id}`} className="hidden sm:block">
            <Badge
              variant={
                job.bestMatch.score >= 70
                  ? "success"
                  : job.bestMatch.score >= 45
                    ? "warning"
                    : "muted"
              }
            >
              {job.bestMatch.score}% vs {job.bestMatch.resumeName}
            </Badge>
          </Link>
        ) : (
          <Badge variant="outline">unmatched</Badge>
        )}
        {job.applications[0] ? (
          <Badge variant="secondary">
            {job.applications[0].status.toLowerCase().replace(/_/g, " ")}
          </Badge>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Job actions">
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem danger onSelect={() => setConfirm(true)}>
              <Trash2 /> Delete posting
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          destructive
          title="Delete this posting?"
          body="Matches computed against it are removed too. Your resumes and profile are untouched."
          confirmLabel="Delete"
          onConfirm={async () => {
            const res = await deleteJobAction({ jobId: job.id });
            if (!res.ok) toast.error(res.error);
            else {
              toast.success("Deleted");
              router.refresh();
            }
          }}
        />
      </Card>
    </li>
  );
}
