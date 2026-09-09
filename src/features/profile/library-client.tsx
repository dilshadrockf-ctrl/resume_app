"use client";
import * as React from "react";
import { Pencil, Plus, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Spinner,
  Field,
  Input,
  Textarea,
} from "@/components/ui/primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import {
  deleteEntryAction,
  restoreEntryAction,
  saveEntryAction,
  type LibraryKind,
} from "@/features/profile/actions";
import { rowToItem, type LibraryRow } from "@/features/profile/entry-map";
import { ItemCard } from "@/features/resume/item-form";
import type { SectionItem } from "@/lib/resume/document";
import { useRouter } from "next/navigation";

const KIND_META: Array<{ kind: LibraryKind; label: string; hint: string }> = [
  {
    kind: "experience",
    label: "Experience",
    hint: "Roles with outcomes — reused across every resume",
  },
  { kind: "education", label: "Education", hint: "" },
  { kind: "project", label: "Projects", hint: "Side projects, OSS, talks, writing" },
  { kind: "skill", label: "Skills", hint: "Include keywords recruiters search for" },
  { kind: "certification", label: "Certifications", hint: "" },
  { kind: "award", label: "Awards", hint: "" },
  { kind: "publication", label: "Publications", hint: "" },
  { kind: "language", label: "Languages", hint: "Spoken languages" },
  { kind: "volunteer", label: "Volunteer", hint: "" },
  { kind: "custom", label: "Custom sections", hint: "Memberships, training, interests — anything" },
];

export function CareerLibrary({
  rows,
  archivedCounts = {},
}: {
  rows: Partial<Record<LibraryKind, LibraryRow[]>>;
  archivedCounts?: Partial<Record<LibraryKind, number>>;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<{
    kind: LibraryKind;
    item: SectionItem;
    id?: string;
  } | null>(null);
  const [busy, setBusy] = React.useState(false);

  function openAdd(kind: LibraryKind) {
    const fake = rowToItem(kind as never, { id: "tmp:new" } as LibraryRow, 0);
    setEditing({ kind, item: fake });
  }

  async function save(item: SectionItem) {
    if (!editing) return;
    setBusy(true);
    const { ref, visible, order, origin, ...data } = item as SectionItem & Record<string, unknown>;
    void ref;
    void visible;
    void order;
    void origin;
    const res = await saveEntryAction({
      kind: editing.kind,
      id: editing.id && !editing.id.startsWith("tmp:") ? editing.id : null,
      data: data as Record<string, unknown>,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      editing.id ? "Updated — every resume using it now shows this" : "Added to your library",
    );
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="grid gap-5">
      {KIND_META.map(({ kind, label, hint }) => {
        const list = rows[kind] ?? [];
        return (
          <Card key={kind}>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>
                  {label}{" "}
                  <Badge variant="muted" className="ml-1">
                    {list.length}
                  </Badge>
                </CardTitle>
                {hint ? <CardDescription>{hint}</CardDescription> : null}
              </div>
              <div className="flex gap-2">
                {archivedCounts[kind] ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      toast.message(
                        `${archivedCounts[kind]} archived ${label.toLowerCase()} entries — restore them from the archived list.`,
                      )
                    }
                  >
                    <ArchiveRestore /> {archivedCounts[kind]} archived
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => openAdd(kind)}>
                  <Plus /> Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2">
              {list.length === 0 ? (
                <EmptyState
                  className="py-8"
                  title={`No ${label.toLowerCase()} yet`}
                  description="Library entries are shared by all your resumes — write them once, perfectly."
                />
              ) : (
                list.map((row, idx) => (
                  <LibraryRowCard
                    key={row.id}
                    kind={kind}
                    row={row}
                    onEdit={() =>
                      setEditing({ kind, item: rowToItem(kind as never, row, idx), id: row.id })
                    }
                    onArchive={async () => {
                      const res = await deleteEntryAction({ kind, id: row.id });
                      if (res.ok) {
                        toast.success(
                          "Archived — resumes referencing it will drop it after next save. Nothing is destroyed.",
                        );
                        router.refresh();
                      } else toast.error(res.error);
                    }}
                  />
                ))
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={Boolean(editing)} onOpenChange={(v) => !v && !busy && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Edit entry" : "New entry"} —{" "}
              {editing && KIND_META.find((k) => k.kind === editing.kind)?.label}
            </DialogTitle>
            <DialogDescription>
              Shared library content: changes apply to every resume that references this entry.
              Hiding it from a single resume is done in that resume&apos;s editor.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <EntryDraft
              key={editing.item.ref?.id ?? editing.kind}
              initial={editing.item}
              busy={busy}
              onSave={save}
              onCancel={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EntryDraft({
  initial,
  onSave,
  onCancel,
  busy,
}: {
  initial: SectionItem;
  onSave: (i: SectionItem) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [item, setItem] = React.useState<SectionItem>(initial);
  return (
    <div>
      <ItemCard
        item={item}
        index={0}
        count={1}
        onChange={(patch) => setItem((prev) => ({ ...prev, ...patch }) as SectionItem)}
        onRemove={() => undefined}
        onMove={() => undefined}
        hideControls
      />
      <DialogFooter className="mt-4">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={() => onSave(item)} disabled={busy}>
          {busy ? <Spinner /> : null} Save entry
        </Button>
      </DialogFooter>
    </div>
  );
}

function LibraryRowCard({
  kind,
  row,
  onEdit,
  onArchive,
}: {
  kind: LibraryKind;
  row: LibraryRow;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const title = String(
    row.title ?? row.name ?? row.institution ?? row.employer ?? row.organization ?? "(untitled)",
  );
  const sub = String(row.employer ?? row.issuer ?? row.role ?? "") || null;
  const bullets = Array.isArray(row.bullets) ? (row.bullets as string[]).length : 0;
  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {title}
          {sub && sub !== title ? <span className="text-muted-foreground"> — {sub}</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {[row.startDate, row.endDate ? `– ${row.endDate}` : row.current ? "– present" : null]
            .filter(Boolean)
            .join(" ") || "No dates"}
          {bullets ? ` · ${bullets} bullet${bullets === 1 ? "" : "s"}` : ""}
        </p>
      </div>
      <Button size="icon-sm" variant="ghost" aria-label={`Edit ${title}`} onClick={onEdit}>
        <Pencil />
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label={`Archive ${title}`} onClick={onArchive}>
        <Archive className="text-muted-foreground" />
      </Button>
    </div>
  );
}
