"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Copy,
  FileText,
  Globe,
  GlobeOff,
  MoreVertical,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { Field, Input } from "@/components/ui/primitives";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import {
  archiveResumeAction,
  deleteResumeAction,
  duplicateResumeAction,
  publishResumeAction,
  renameResumeAction,
  restoreResumeAction,
} from "@/features/resume/actions";
import { timeAgo } from "@/lib/utils";
import type { ResumeListItem } from "@/features/resume/service";

export function ResumeRow({ resume }: { resume: ResumeListItem }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [renaming, setRenaming] = React.useState(false);
  const [name, setName] = React.useState(resume.name);
  const [busy, setBusy] = React.useState(false);

  return (
    <li>
      <Card className="flex items-center gap-3 px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/resumes/${resume.id}`}
            className="block truncate text-sm font-medium hover:underline"
          >
            {resume.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            Edited {timeAgo(resume.updatedAt)} · template {resume.templateId}
          </p>
        </div>
        {resume.published ? (
          <Badge variant="success" className="hidden sm:inline-flex">
            <Globe className="size-3" /> Public
          </Badge>
        ) : null}
        {resume.archivedAt ? <Badge variant="muted">Archived</Badge> : null}
        <div className="flex items-center gap-1">
          <Button asChild size="sm" variant="outline">
            <Link href={`/resumes/${resume.id}`}>Open</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Actions for ${resume.name}`}
                disabled={busy}
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onSelect={() => {
                  setName(resume.name);
                  setRenaming(true);
                }}
              >
                <Pencil /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  void (async () => {
                    setBusy(true);
                    const res = await duplicateResumeAction({ resumeId: resume.id });
                    setBusy(false);
                    if (res.ok) {
                      toast.success("Duplicated");
                      router.refresh();
                    } else toast.error(res.error);
                  })()
                }
              >
                <Copy /> Duplicate
              </DropdownMenuItem>
              {!resume.archivedAt && (
                <DropdownMenuItem
                  onSelect={() =>
                    void (async () => {
                      setBusy(true);
                      const res = await publishResumeAction({
                        resumeId: resume.id,
                        published: !resume.published,
                      });
                      setBusy(false);
                      if (res.ok && res.data.slug) {
                        toast.success(`Public link: ${res.data.url}`);
                        void navigator.clipboard
                          ?.writeText(res.data.url ?? "")
                          .catch(() => undefined);
                      } else if (res.ok) {
                        toast.success("Unpublished");
                      } else toast.error(res.error);
                      router.refresh();
                    })()
                  }
                >
                  {resume.published ? <GlobeOff /> : <Share2 />}{" "}
                  {resume.published ? "Unpublish" : "Publish link"}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {resume.archivedAt ? (
                <DropdownMenuItem
                  onSelect={() =>
                    void (async () => {
                      setBusy(true);
                      await restoreResumeAction({ resumeId: resume.id });
                      setBusy(false);
                      router.refresh();
                    })()
                  }
                >
                  <ArchiveRestore /> Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onSelect={() =>
                    void (async () => {
                      setBusy(true);
                      await archiveResumeAction({ resumeId: resume.id, archived: true });
                      setBusy(false);
                      router.refresh();
                    })()
                  }
                >
                  <Archive /> Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuItem danger onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete this resume?"
          destructive
          confirmLabel="Delete resume"
          body="Your career profile and every saved entry are untouched — deleting a resume only removes this composition. You can restore it from archived."
          onConfirm={async () => {
            const res = await deleteResumeAction({ resumeId: resume.id });
            if (!res.ok) toast.error(res.error);
            else toast.success("Resume deleted — your career profile is intact.");
            router.refresh();
          }}
        />

        <Dialog open={renaming} onOpenChange={(v) => !busy && setRenaming(v)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Rename resume</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const res = await renameResumeAction({ resumeId: resume.id, name: name.trim() });
                setBusy(false);
                if (res.ok) {
                  setRenaming(false);
                  router.refresh();
                } else toast.error(res.error);
              }}
            >
              <Field label="Name" htmlFor="rename">
                <Input
                  id="rename"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  autoFocus
                />
              </Field>
              <DialogFooter className="mt-4">
                <Button type="button" variant="ghost" onClick={() => setRenaming(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || !name.trim()}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </Card>
    </li>
  );
}
