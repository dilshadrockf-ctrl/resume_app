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
import { deleteApplicationAction, updateApplicationAction } from "@/features/applications/actions";
import { timeAgo } from "@/lib/utils";

export type AppRowData = {
  id: string;
  company: string;
  role: string;
  status: string;
  updatedAt: Date;
  appliedAt: Date | null;
  versionLabel: string | null;
};

const NEXT: Record<string, string | undefined> = {
  SAVED: "PREPARING",
  PREPARING: "APPLIED",
  APPLIED: "RECRUITER_SCREEN",
  RECRUITER_SCREEN: "INTERVIEW",
  INTERVIEW: "TECHNICAL_INTERVIEW",
  TECHNICAL_INTERVIEW: "FINAL_INTERVIEW",
  FINAL_INTERVIEW: "OFFER",
};
const ACTIVE = new Set([
  "SAVED",
  "PREPARING",
  "APPLIED",
  "RECRUITER_SCREEN",
  "INTERVIEW",
  "TECHNICAL_INTERVIEW",
  "FINAL_INTERVIEW",
]);

export const ALL_STATUSES = [
  "SAVED",
  "PREPARING",
  "APPLIED",
  "RECRUITER_SCREEN",
  "INTERVIEW",
  "TECHNICAL_INTERVIEW",
  "FINAL_INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
] as const;

export function AppRow({ app }: { app: AppRowData }) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState(false);
  const next = NEXT[app.status];
  return (
    <li>
      <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/applications/${app.id}`}
            className="truncate text-sm font-medium hover:underline"
          >
            {app.role} · {app.company}
          </Link>
          <p className="text-xs text-muted-foreground">
            {app.appliedAt ? `applied ${timeAgo(app.appliedAt)} · ` : "not yet applied · "}
            {app.versionLabel ? `sent: ${app.versionLabel} · ` : "no version linked · "}
            updated {timeAgo(app.updatedAt)}
          </p>
        </div>
        <Badge
          variant={
            app.status === "OFFER"
              ? "success"
              : app.status === "REJECTED" || app.status === "WITHDRAWN"
                ? "muted"
                : "secondary"
          }
        >
          {app.status.toLowerCase().replace(/_/g, " ")}
        </Badge>
        {next && ACTIVE.has(app.status) ? (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const res = await updateApplicationAction({ id: app.id, status: next as never });
              if (res.ok) {
                toast.success(`Moved to ${next.toLowerCase().replace(/_/g, " ")}`);
                router.refresh();
              } else toast.error(res.error);
            }}
          >
            → {next.toLowerCase().replace(/_/g, " ")}
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Application actions">
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {ALL_STATUSES.map((s) => (
              <DropdownMenuItem
                key={s}
                onSelect={async () => {
                  if (s === app.status) return;
                  await updateApplicationAction({ id: app.id, status: s });
                  router.refresh();
                }}
              >
                {s.toLowerCase().replace(/_/g, " ")}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem danger onSelect={() => setConfirm(true)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          destructive
          title="Delete this application?"
          body="Notes go with it. Linked documents are untouched."
          confirmLabel="Delete"
          onConfirm={async () => {
            const res = await deleteApplicationAction({ id: app.id });
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
