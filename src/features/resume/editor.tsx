"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileDown,
  FileText,
  GitCompare,
  Globe,
  Loader2,
  Palette,
  Pencil,
  Rocket,
  Save,
  Sparkles,
  Undo2,
  Zap,
  CheckCircle2,
} from "lucide-react";
import type { ResumeDocument, SectionKind, TemplateConfig } from "@/lib/resume/document";
import {
  addItem,
  blankItem,
  DEFAULT_SECTION_TITLES,
  moveItem,
  moveSection,
  normalizeDoc,
  removeItem,
  sectionFor,
  setConfig,
  setSectionTitle,
  setSectionVisible,
  setSummary,
  updateItem,
} from "@/features/resume/editor-model";
import { type LibraryKindKey, type LibraryRow, rowToItem } from "@/features/profile/entry-map";
import {
  duplicateResumeAction,
  publishResumeAction,
  renameResumeAction,
  requestExportAction,
  getExportStatusAction,
  saveResumeAction,
  switchTemplateAction,
  restoreVersionAction,
  loadVersionsAction,
  loadResumeForEditorAction,
} from "@/features/resume/actions";
import { saveProfileAction } from "@/features/profile/actions";
import { computeStats } from "@/lib/resume/stats";
import { TEMPLATES, getTemplate } from "@/templates/catalog";
import { Button } from "@/components/ui/button";
import { Badge, Card, Field, Input, Skeleton, Spinner, Textarea } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { cn, timeAgo } from "@/lib/utils";
import { ResumePreview } from "@/features/resume/preview";
import { ItemCard, AddItemButton } from "@/features/resume/item-form";
import { profileToContact, type ContactForm } from "@/features/resume/contact-form";

/**
 * The resume editor. Everything about saving is engineered around one rule:
 * never lose what the user typed (§103-§105). Autosave debounces, serializes,
 * retries with backoff, keeps the working copy in memory across failures, and
 * a manual save always remains possible.
 */

export interface EditorProps {
  resumeId: string;
  initialDoc: ResumeDocument;
  library: Partial<Record<LibraryKindKey, LibraryRow[]>>;
  contact: ContactForm;
  aiConfigured: boolean;
}

type SaveState =
  { kind: "clean" } | { kind: "dirty" } | { kind: "saving" } | { kind: "error"; attempt: number };

const SECTION_TO_LIB: Partial<Record<SectionKind, LibraryKindKey>> = {
  EXPERIENCE: "experience",
  EDUCATION: "education",
  PROJECTS: "project",
  SKILLS: "skill",
  CERTIFICATIONS: "certification",
  AWARDS: "award",
  PUBLICATIONS: "publication",
  LANGUAGES: "language",
  VOLUNTEER: "volunteer",
  CUSTOM: "custom",
};

import { AiDialog } from "@/features/ai/components/ai-dialog";
import type { Suggestion } from "@/features/ai/actions";

export function ResumeEditor({
  resumeId,
  initialDoc,
  library,
  contact: initialContact,
  aiConfigured,
}: EditorProps) {
  const router = useRouter();
  const [doc, setDoc] = React.useState<ResumeDocument>(initialDoc);
  const docRef = React.useRef(doc);
  docRef.current = doc;

  const [saveState, setSaveState] = React.useState<SaveState>({ kind: "clean" });
  const dirtyRef = React.useRef(false);
  const inFlightRef = React.useRef<Promise<boolean> | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = React.useRef(0);
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);

  const [versionCount, setVersionCount] = React.useState<number | null>(null);

  // ────────────────────────── save engine ──────────────────────────────────
  const doSave = React.useCallback(
    (mode: "autosave" | "manual", label?: string): Promise<boolean> => {
      if (inFlightRef.current) {
        // serialize: wait for the running save, then chain ours
        return inFlightRef.current.then(() => doSave(mode, label));
      }
      const payload = normalizeDoc(docRef.current);
      const p = (async (): Promise<boolean> => {
        setSaveState({ kind: "saving" });
        try {
          const res = await saveResumeAction({ resumeId, doc: payload, mode, label });
          if (!res.ok) throw new Error(res.error);
          const idMap = res.data.idMap ?? {};
          if (Object.keys(idMap).length) {
            const next = applyIdMap(docRef.current, idMap);
            docRef.current = next;
            setDoc(next);
          }
          attemptsRef.current = 0;
          dirtyRef.current = false;
          setSaveState({ kind: "clean" });
          setLastSaved(new Date());
          if (res.data.versionCreated) setVersionCount((v) => (v ?? 0) + 1);
          return true;
        } catch (e) {
          attemptsRef.current += 1;
          const attempt = attemptsRef.current;
          setSaveState({ kind: "error", attempt });
          if (attempt === 2)
            toast.error("Couldn't reach the server — your work is safe in this tab, retrying…");
          if (attempt < 10) {
            const delay = Math.min(30_000, 1500 * 2 ** (attempt - 1));
            if (retryRef.current) clearTimeout(retryRef.current);
            retryRef.current = setTimeout(() => void doSave("autosave"), delay);
          } else {
            toast.error(
              "Autosave paused after many failures. Use “Save now” when you're back online.",
            );
          }
          void e;
          return false;
        } finally {
          inFlightRef.current = null;
        }
      })();
      inFlightRef.current = p;
      return p;
    },
    [resumeId],
  );

  const edit = React.useCallback(
    (updater: (d: ResumeDocument) => ResumeDocument) => {
      setDoc((prev) => {
        const next = updater(prev);
        docRef.current = next;
        return next;
      });
      dirtyRef.current = true;
      setSaveState((s) => (s.kind === "error" ? s : { kind: "dirty" }));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (saveState.kind !== "error") {
        timerRef.current = setTimeout(() => void doSave("autosave"), 1400);
      }
    },
    [doSave, saveState.kind],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // flush on tab hide + guard unload while dirty (§105: never silently lose)
  React.useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden" && dirtyRef.current) void doSave("autosave");
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onUnload);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [doSave]);

  React.useEffect(() => {
    document.title = `${dirtyRef.current ? "● " : ""}${doc.meta.name} · ResumeForge`;
  }, [doc.meta.name, saveState.kind]);

  // ──────────────────────────────────────────────────────────────────────────

  const stats = React.useMemo(() => computeStats(doc), [doc]);
  const template = getTemplate(doc.meta.templateId);

  const sections = React.useMemo(
    () => [...doc.sections].sort((a, b) => a.order - b.order),
    [doc.sections],
  );

  const [dialog, setDialog] = React.useState<
    null | "template" | "versions" | "export" | "contact" | "publish" | "ai"
  >(null);

  React.useEffect(() => {
    const ai = new URLSearchParams(window.location.search).get("ai");
    if (ai === "1") {
      setDialog("ai");
      window.history.replaceState(null, "", `/resumes/${resumeId}`);
    }
  }, [resumeId]);
  const [renaming, setRenaming] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState(doc.meta.name);

  function renameCommit() {
    setRenaming(false);
    const clean = nameDraft.trim();
    if (!clean || clean === doc.meta.name) {
      setNameDraft(doc.meta.name);
      return;
    }
    edit((d) => ({ ...d, meta: { ...d.meta, name: clean } }));
    void renameResumeAction({ resumeId, name: clean });
  }

  return (
    <div className="flex h-dvh flex-col">
      {/* ── top bar ── */}
      <header className="z-30 flex h-12 shrink-0 items-center gap-2 border-b bg-card/80 px-3 backdrop-blur">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Back to resumes">
          <Link href="/resumes">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          {renaming ? (
            <input
              autoFocus
              className="h-7 w-56 rounded-md border border-input bg-background px-2 text-sm font-semibold"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={renameCommit}
              onKeyDown={(e) => {
                if (e.key === "Enter") renameCommit();
                if (e.key === "Escape") {
                  setRenaming(false);
                  setNameDraft(doc.meta.name);
                }
              }}
            />
          ) : (
            <button
              className="group flex min-w-0 items-center gap-1.5 text-sm font-semibold"
              onClick={() => setRenaming(true)}
              title="Click to rename"
            >
              <span className="truncate">{doc.meta.name}</span>
              <Pencil
                className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            </button>
          )}
          <SaveIndicator
            state={saveState}
            lastSaved={lastSaved}
            onRetry={() => void doSave("autosave")}
          />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={() => setDialog("contact")}>
                <UserIcon /> Contact
              </Button>
            </TooltipTrigger>
            <TooltipContent>Shared across all resumes (your profile)</TooltipContent>
          </Tooltip>
          <Button size="sm" variant="ghost" onClick={() => setDialog("template")}>
            <Palette /> <span className="hidden xl:inline">{template.name}</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDialog("versions")}>
            <Clock3 />{" "}
            <span className="hidden xl:inline">
              {versionCount === null ? "History" : `${versionCount}`}
            </span>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={() => setDialog("ai")}>
                <Sparkles /> <span className="hidden xl:inline">AI</span>
                {!aiConfigured ? <span className="sr-only"> (not configured)</span> : null}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {aiConfigured
                ? "Rewrite, tailor, quantify — always behind a review step"
                : "Not configured — click to see how to enable (optional)"}
            </TooltipContent>
          </Tooltip>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              dirtyRef.current = true;
              void doSave("manual", "Checkpoint");
            }}
          >
            <Save /> <span className="hidden lg:inline">Save</span>
          </Button>
          <Button size="sm" onClick={() => setDialog("export")}>
            <FileDown /> Export
          </Button>
        </div>
      </header>

      {/* error banner */}
      {saveState.kind === "error" ? (
        <div className="flex items-center gap-2 border-b bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-3.5" aria-hidden />
          Offline or server error — {saveState.attempt} failed{" "}
          {saveState.attempt === 1 ? "attempt" : "attempts"}. Nothing you typed has been lost; the
          editor keeps retrying.
          <button className="ml-1 font-semibold underline" onClick={() => void doSave("autosave")}>
            Retry now
          </button>
        </div>
      ) : null}

      {/* ── body ── */}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(340px,440px)_1fr] xl:grid-cols-[minmax(380px,480px)_1fr]">
        <section
          aria-label="Content editor"
          className="min-h-0 overflow-y-auto border-r bg-muted/30 p-3 lg:p-4"
        >
          <SummaryCard
            doc={doc}
            onChange={(v) => edit((d) => setSummary(d, v))}
            onToggle={(v) => edit((d) => setSectionVisible(d, "SUMMARY" as SectionKind, v))}
          />
          <div className="mt-3 grid gap-2">
            {sections
              .filter((s) => s.kind !== "SUMMARY")
              .map((section, si) => (
                <SectionCard
                  key={section.kind}
                  doc={doc}
                  sectionKind={section.kind}
                  index={si}
                  count={sections.filter((x) => x.kind !== "SUMMARY").length}
                  library={
                    SECTION_TO_LIB[section.kind]
                      ? (library[SECTION_TO_LIB[section.kind]!] ?? [])
                      : []
                  }
                  onEdit={(fn) => edit(fn)}
                />
              ))}
          </div>
          <Card className="mt-3 border-dashed p-3 text-xs text-muted-foreground">
            Deleting a resume — or hiding an item — never removes anything from your career profile.
            Hiding an item keeps it available for other resumes.
          </Card>
          <div className="h-6" />
        </section>

        <section
          aria-label="Preview"
          className="relative hidden min-h-0 flex-col bg-muted/50 lg:flex"
        >
          <PreviewToolbar
            doc={doc}
            stats={stats}
            onChangeConfig={(patch) => edit((d) => setConfig(d, patch))}
            onTemplate={() => setDialog("template")}
          />
          <ResumePreview doc={doc} zoom={0.9} />
        </section>

        {/* mobile: preview as dialog-lite overlay */}
        <MobilePreviewFab doc={doc} />
      </div>

      {/* dialogs */}
      <TemplateDialog
        open={dialog === "template"}
        onClose={() => setDialog(null)}
        current={doc.meta.templateId}
        onPick={async (tid) => {
          const res = await switchTemplateAction({ resumeId, templateId: tid });
          if (res.ok) {
            edit((d) => ({ ...d, meta: { ...d.meta, templateId: tid } }));
            toast.success("Template switched — content untouched.");
            router.refresh();
          } else toast.error(res.error);
          setDialog(null);
        }}
      />

      <VersionsDialog
        open={dialog === "versions"}
        onClose={() => setDialog(null)}
        resumeId={resumeId}
        onRestore={async (vid) => {
          const res = await restoreVersionAction({ resumeId, versionId: vid });
          if (res.ok) {
            const reload = await loadResumeForEditorAction({ resumeId });
            if (reload.ok) {
              docRef.current = reload.data.doc;
              setDoc(reload.data.doc);
              dirtyRef.current = false;
              setSaveState({ kind: "clean" });
            }
            toast.success("Version restored");
            router.refresh();
          } else toast.error(res.error);
        }}
      />

      <ExportDialog
        open={dialog === "export"}
        onClose={() => setDialog(null)}
        resumeId={resumeId}
      />

      <ContactDialog
        open={dialog === "contact"}
        initial={initialContact}
        onClose={() => setDialog(null)}
        onSave={async (values) => {
          const res = await saveProfileAction(values);
          if (res.ok) {
            setDialog(null);
            toast.success("Contact updated everywhere (your profile is the source).");
            router.refresh();
          } else toast.error(res.error);
        }}
      />

      <PublishDialog
        open={dialog === "publish"}
        onClose={() => setDialog(null)}
        resumeId={resumeId}
      />

      <AiDialog
        open={dialog === "ai"}
        onClose={() => setDialog(null)}
        resumeId={resumeId}
        sections={doc.sections
          .filter((s) => s.visible)
          .map((s) => ({
            kind: s.kind,
            title: s.title ?? s.kind,
            items: s.items.map((_, i) => i),
          }))}
        apply={(sg) =>
          edit((d) => {
            if (sg.sectionKind === "SUMMARY") return setSummary(d, sg.suggested);
            const lines = sg.suggested
              .split(/\r?\n/)
              .map((l) => l.replace(/^\s*[-•·*]\s*/, "").trim())
              .filter(Boolean);
            const sec = d.sections.find((x) => x.kind === sg.sectionKind);
            const cur = sec?.items[sg.itemIndex] as { bullets?: unknown } | undefined;
            const patch =
              cur && Array.isArray(cur.bullets)
                ? { bullets: lines }
                : { description: sg.suggested };
            return updateItem(d, sg.sectionKind as never, sg.itemIndex, patch as never);
          })
        }
      />
    </div>
  );

  // helpers
  function applyIdMap(d: ResumeDocument, map: Record<string, string>): ResumeDocument {
    return {
      ...d,
      sections: d.sections.map((s) => ({
        ...s,
        items: s.items.map((it) =>
          it.ref && map[it.ref.id]
            ? ({ ...it, ref: { ...it.ref, id: map[it.ref.id]! } } as typeof it)
            : it,
        ),
      })),
    };
  }
}

function UserIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c2-3.5 5-5 8-5s6 1.5 8 5" />
    </svg>
  );
}

// ────────────────────────────── save indicator ───────────────────────────────

function SaveIndicator({
  state,
  lastSaved,
  onRetry,
}: {
  state: SaveState;
  lastSaved: Date | null;
  onRetry: () => void;
}) {
  if (state.kind === "saving")
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Saving…
      </span>
    );
  if (state.kind === "dirty")
    return <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved</span>;
  if (state.kind === "error")
    return (
      <button
        onClick={onRetry}
        className="flex items-center gap-1 text-xs font-medium text-destructive underline"
      >
        Save failed — retry
      </button>
    );
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Check className="size-3 text-success" aria-hidden />
      {lastSaved ? `Saved ${timeAgo(lastSaved)}` : "Saved"}
    </span>
  );
}

// ────────────────────────────── summary ──────────────────────────────────────

function SummaryCard({
  doc,
  onChange,
  onToggle,
}: {
  doc: ResumeDocument;
  onChange: (v: string) => void;
  onToggle: (v: boolean) => void;
}) {
  const section = doc.sections.find((s) => s.kind === "SUMMARY");
  const visible = section ? section.visible : false;
  return (
    <Card>
      <div className="flex items-center gap-2 px-4 pt-3">
        <h3 className="text-sm font-semibold">Summary</h3>
        <Switch
          checked={visible}
          onCheckedChange={onToggle}
          aria-label="Show summary on resume"
          className="ml-auto"
          id="sum-switch"
        />
      </div>
      <div className="p-3">
        <Textarea
          rows={3}
          placeholder="Two or three lines: who you are, what you're great at, what you want next. Keep it factual."
          value={doc.summary}
          onChange={(e) => onChange(e.target.value)}
        />
        {!visible ? (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <EyeOff className="size-3" /> Hidden from the document. <Zap className="size-3" /> It
            still counts toward content checks.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

// ────────────────────────────── section card ─────────────────────────────────

function SectionCard({
  doc,
  sectionKind,
  index,
  count,
  library,
  onEdit,
}: {
  doc: ResumeDocument;
  sectionKind: SectionKind;
  index: number;
  count: number;
  library: LibraryRow[];
  onEdit: (fn: (d: ResumeDocument) => ResumeDocument) => void;
}) {
  const [open, setOpen] = React.useState(sectionKind === "EXPERIENCE");
  const [titleEdit, setTitleEdit] = React.useState(false);
  const [picker, setPicker] = React.useState(false);
  const section = doc.sections.find((s) => s.kind === sectionKind) ?? sectionFor(doc, sectionKind);
  const items = [...section.items].sort((a, b) => a.order - b.order);

  return (
    <Card>
      <div className="flex items-center gap-1.5 px-3 py-2">
        {titleEdit ? (
          <SectionTitleInput
            value={section.title ?? DEFAULT_SECTION_TITLES[sectionKind]}
            onDone={(v) => {
              onEdit((d) =>
                setSectionTitle(
                  d,
                  sectionKind,
                  v === DEFAULT_SECTION_TITLES[sectionKind] ? undefined : v,
                ),
              );
              setTitleEdit(false);
            }}
          />
        ) : (
          <button
            className="text-sm font-semibold hover:underline"
            onClick={() => {
              setOpen((v) => !v);
              setTitleEdit(false);
            }}
            title="Click to expand; double-click to rename"
          >
            {section.title ?? DEFAULT_SECTION_TITLES[sectionKind]}
            <Badge variant="muted" className="ml-1.5">
              {items.filter((i) => i.visible).length}
            </Badge>
          </button>
        )}
        <div className="ml-auto flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Rename section"
            onDoubleClick={() => setTitleEdit(true)}
            onClick={() => setTitleEdit(true)}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Move section up"
            disabled={index === 0}
            onClick={() =>
              onEdit((d) =>
                moveSection(
                  d,
                  index +
                    (d.sections.some((s) => s.kind === "SUMMARY" && s.order < section.order)
                      ? 1
                      : 0),
                  Math.max(0, index - 1),
                ),
              )
            }
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Move section down"
            disabled={index >= count - 1}
            onClick={() => onEdit((d) => moveSection(d, index, Math.min(count - 1, index + 1)))}
          >
            ↓
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={section.visible ? "Hide section" : "Show section"}
            title={section.visible ? "Hide section (content is kept)" : "Show section"}
            onClick={() => onEdit((d) => setSectionVisible(d, sectionKind, !section.visible))}
          >
            {section.visible ? <Eye /> : <EyeOff />}
          </Button>
        </div>
      </div>
      {open ? (
        <div className="grid gap-2 border-t px-3 py-3">
          {!section.visible ? (
            <p className="rounded-md bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground">
              Hidden — items below stay in your profile and other resumes; nothing is deleted.
            </p>
          ) : null}
          {items.map((item, i) => (
            <ItemCard
              key={item.ref?.id ?? `${sectionKind}-${i}`}
              item={item}
              index={i}
              count={items.length}
              onChange={(patch) => onEdit((d) => updateItem(d, sectionKind, i, patch))}
              onRemove={() => onEdit((d) => removeItem(d, sectionKind, i))}
              onMove={(to) => onEdit((d) => moveItem(d, sectionKind, i, to))}
            />
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <AddItemButton
              label="Add new"
              onClick={() =>
                onEdit((d) => {
                  const sec = sectionFor(d, sectionKind);
                  const kind =
                    sec.kind === "SKILLS"
                      ? "skill"
                      : sec.kind === "PROJECTS"
                        ? "project"
                        : sec.kind === "EDUCATION"
                          ? "education"
                          : sec.kind === "CERTIFICATIONS"
                            ? "certification"
                            : sec.kind === "AWARDS"
                              ? "award"
                              : sec.kind === "PUBLICATIONS"
                                ? "publication"
                                : sec.kind === "LANGUAGES"
                                  ? "language"
                                  : sec.kind === "VOLUNTEER"
                                    ? "volunteer"
                                    : sec.kind === "CUSTOM"
                                      ? "custom"
                                      : "experience";
                  return addItem(d, sectionKind, blankItem(kind, sectionKind));
                })
              }
            />
            {library.length > 0 ? (
              <AddItemButton
                label={`Attach from profile (${library.length})`}
                onClick={() => setPicker(true)}
              />
            ) : null}
          </div>
          <LibraryPickerDialog
            open={picker}
            onClose={() => setPicker(false)}
            libraryKind={SECTION_KIND_TO_LIB(sectionKind)}
            rows={library}
            attachedIds={new Set(items.map((i) => i.ref?.id))}
            onAttach={(row) => {
              const kind = SECTION_KIND_TO_LIB(sectionKind);
              if (!kind) return;
              onEdit((d) => addItem(d, sectionKind, rowToItem(kind, row, items.length)));
              setPicker(false);
              toast.success("Attached — this links the same entry, no duplicate created.");
            }}
          />
        </div>
      ) : null}
    </Card>
  );
}

function SECTION_KIND_TO_LIB(k: SectionKind): LibraryKindKey | null {
  return SECTION_TO_LIB[k] ?? null;
}

function SectionTitleInput({ value, onDone }: { value: string; onDone: (v: string) => void }) {
  const [v, setV] = React.useState(value);
  return (
    <input
      autoFocus
      className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-sm font-semibold"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onDone(v.trim() || value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onDone(v.trim() || value);
        if (e.key === "Escape") onDone(value);
      }}
    />
  );
}

function LibraryPickerDialog({
  open,
  onClose,
  libraryKind,
  rows,
  attachedIds,
  onAttach,
}: {
  open: boolean;
  onClose: () => void;
  libraryKind: LibraryKindKey | null;
  rows: LibraryRow[];
  attachedIds: Set<string>;
  onAttach: (row: LibraryRow) => void;
}) {
  if (!libraryKind) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Attach from your career profile</DialogTitle>
          <DialogDescription>
            These entries already exist — attaching links them, editing here updates the shared
            copy.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-80 gap-1.5 overflow-y-auto">
          {rows
            .filter((r) => !attachedIds.has(r.id))
            .map((r) => (
              <button
                key={r.id}
                className="rounded-lg border px-3 py-2 text-left text-sm hover:border-primary/40 hover:bg-accent"
                onClick={() => onAttach(r)}
              >
                <span className="font-medium">
                  {String(
                    r.title ??
                      r.name ??
                      r.institution ??
                      r.employer ??
                      r.organization ??
                      "(untitled)",
                  )}
                </span>
                {r.employer ? (
                  <span className="text-muted-foreground"> — {String(r.employer)}</span>
                ) : null}
                {r.issuer ? (
                  <span className="text-muted-foreground"> — {String(r.issuer)}</span>
                ) : null}
              </button>
            ))}
          {rows.filter((r) => !attachedIds.has(r.id)).length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              Everything from your profile is attached. Add more on the Career profile page.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────── preview toolbar ──────────────────────────────

function PreviewToolbar({
  doc,
  stats,
  onChangeConfig,
  onTemplate,
}: {
  doc: ResumeDocument;
  stats: ReturnType<typeof computeStats>;
  onChangeConfig: (p: Partial<TemplateConfig>) => void;
  onTemplate: () => void;
}) {
  const cfg = doc.meta.config;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-1.5 text-xs">
      <span className="font-medium">{stats.score}%</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "cursor-help rounded-full px-1.5 font-semibold",
              stats.score >= 75
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : stats.score >= 50
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-red-500/15 text-red-600 dark:text-red-400",
            )}
          >
            content check
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Local checklist — verbs, numbers, completeness. Not an ATS guarantee; real systems score
          differently.
        </TooltipContent>
      </Tooltip>
      {stats.onePageRisk !== "low" ? (
        <Badge variant={stats.onePageRisk === "high" ? "destructive" : "warning"}>
          ~{stats.estimatedLines} lines —{" "}
          {stats.onePageRisk === "high" ? "over one page" : "near one page"}
        </Badge>
      ) : (
        <Badge variant="success">≈ one page</Badge>
      )}
      <div className="ml-auto flex items-center gap-1">
        <label className="flex items-center gap-1">
          <span className="text-muted-foreground">Font</span>
          <select
            className="h-6 rounded border border-input bg-card px-1 text-[11px]"
            value={cfg.baseFont}
            onChange={(e) => onChangeConfig({ baseFont: e.target.value as never })}
          >
            <option value="inter">Inter</option>
            <option value="lora">Lora</option>
            <option value="mono">Mono</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-muted-foreground">Size</span>
          <input
            type="range"
            min={8}
            max={13}
            step={0.5}
            value={cfg.fontSize}
            onChange={(e) => onChangeConfig({ fontSize: Number(e.target.value) })}
            className="w-16 accent-[var(--primary)]"
            aria-label="Base font size (pt)"
          />
          <span className="w-8 tabular-nums">{cfg.fontSize}pt</span>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-muted-foreground">Margins</span>
          <input
            type="range"
            min={0.6}
            max={1.4}
            step={0.05}
            value={cfg.marginScale}
            onChange={(e) => onChangeConfig({ marginScale: Number(e.target.value) })}
            className="w-16 accent-[var(--primary)]"
            aria-label="Margin scale"
          />
        </label>
        <Button size="sm" variant="ghost" onClick={onTemplate}>
          More styles
        </Button>
      </div>
    </div>
  );
}

// ────────────────────────────── template dialog ──────────────────────────────

function TemplateDialog({
  open,
  onClose,
  current,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  current: string;
  onPick: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Templates</DialogTitle>
          <DialogDescription>
            Switching re-lays your content instantly — text, bullets and links are preserved
            exactly, and the switch itself is versioned.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => onPick(t.id)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/50",
                t.id === current && "border-primary ring-1 ring-primary/40",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                {t.name}
                {t.id === current ? <Badge variant="success">current</Badge> : null}
              </span>
              <span className="text-xs text-muted-foreground">{t.description}</span>
              <span className="mt-1 flex gap-1">
                <Badge variant="outline">{t.tags[0] ?? t.tags.join(" · ")}</Badge>
                <Badge
                  variant={
                    t.ats === "excellent" ? "success" : t.ats === "good" ? "secondary" : "warning"
                  }
                >
                  ATS {t.ats}
                </Badge>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────── versions dialog ──────────────────────────────

interface VersionRow {
  id: string;
  label: string;
  source: string;
  createdAt: string;
  note: string | null;
  isPrimary: boolean;
  atsScore: number | null;
  jobDescription: { title: string; company: string } | null;
}

function VersionsDialog({
  open,
  onClose,
  resumeId,
  onRestore,
}: {
  open: boolean;
  onClose: () => void;
  resumeId: string;
  onRestore: (id: string) => void;
}) {
  const [rows, setRows] = React.useState<VersionRow[] | null>(null);
  const [compare, setCompare] = React.useState(false);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setRows(null);
      void (async () => {
        const res = await loadVersionsAction({ resumeId });
        setRows(res.ok ? (res.data as VersionRow[]) : []);
      })();
    }
  }, [open, resumeId]);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Every manual save and periodic autosave snapshot. Restoring saves the current state
            first — nothing gets lost either way.
          </DialogDescription>
        </DialogHeader>
        {rows === null ? (
          <div className="grid gap-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No saved versions yet. Press Save to create one.
          </p>
        ) : (
          <ul className="grid max-h-[46vh] gap-1.5 overflow-y-auto" role="list">
            {rows.map((v) => (
              <li key={v.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {v.label}
                    {v.isPrimary ? (
                      <Badge variant="secondary" className="ml-1.5">
                        primary
                      </Badge>
                    ) : null}
                    {v.atsScore != null ? (
                      <span className="ml-1.5 text-xs text-muted-foreground">{v.atsScore}%</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(v.createdAt).toLocaleString()} · {v.source.toLowerCase()}
                    {v.jobDescription ? ` · for ${v.jobDescription.company}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setConfirmId(v.id)}>
                  <Undo2 /> Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setCompare((v) => !v)}>
            <GitCompare /> {compare ? "Hide diff" : "Show what changed (summary level)"}
          </Button>
        </DialogFooter>
        {compare && rows && rows.length >= 2 ? (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Latest “{rows[0]!.label}” (
            {rows[0]!.note?.startsWith("hash:")
              ? "content changed since last autosave"
              : "explicit save"}
            ) vs “{rows[1]!.label}”. Full text diff comes with the AI-review phase; snapshots
            restore completely either way.
          </p>
        ) : null}
        <ConfirmDialog
          open={Boolean(confirmId)}
          onOpenChange={(v) => !v && setConfirmId(null)}
          title="Restore this version?"
          body="Your current state is snapshotted first, so you can undo the undo."
          confirmLabel="Restore"
          onConfirm={() => {
            if (confirmId) onRestore(confirmId);
            setConfirmId(null);
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────── export dialog ────────────────────────────────

const EXPORT_FORMATS = [
  {
    id: "pdf",
    label: "PDF",
    hint: "Selectable text, real links — what recruiters expect",
    icon: FileText,
  },
  {
    id: "docx",
    label: "DOCX",
    hint: "For people who ask to edit; opens in Word & Google Docs",
    icon: FileText,
  },
  {
    id: "text",
    label: "Plain text",
    hint: "Paste into application forms and email bodies",
    icon: FileText,
  },
] as const;

function ExportDialog({
  open,
  onClose,
  resumeId,
}: {
  open: boolean;
  onClose: () => void;
  resumeId: string;
}) {
  const [state, setState] = React.useState<{
    format: string;
    status: "queued" | "working" | "ready" | "failed";
    id?: string;
    fileName?: string;
    error?: string;
  } | null>(null);

  React.useEffect(() => {
    if (!open) setState(null);
  }, [open]);

  React.useEffect(() => {
    if (!state || (state.status !== "queued" && state.status !== "working") || !state.id) return;
    let alive = true;
    let tries = 0;
    const exportId = state.id;
    if (!exportId) return;
    const poll = setInterval(async () => {
      tries++;
      if (tries > 60) {
        if (alive)
          setState((s) =>
            s
              ? {
                  ...s,
                  status: "failed",
                  error:
                    "Timed out — the job may still finish; check the badge on Settings → Data.",
                }
              : s,
          );
        clearInterval(poll);
        return;
      }
      const res = await getExportStatusAction({ exportId });
      if (!alive) return;
      if (!res.ok) return;
      const s = res.data.status;
      if (s === "READY") {
        setState((prev) =>
          prev ? { ...prev, status: "ready", fileName: res.data.fileName } : prev,
        );
        clearInterval(poll);
      } else if (s === "FAILED") {
        setState((prev) =>
          prev ? { ...prev, status: "failed", error: res.data.error ?? "Render failed" } : prev,
        );
        clearInterval(poll);
      } else {
        setState((prev) => (prev ? { ...prev, status: "working" } : prev));
      }
    }, 900);
    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, [state?.id, state?.status === "ready"]);

  async function start(format: "pdf" | "docx" | "text") {
    setState({ format, status: "queued" });
    const res = await requestExportAction({ resumeId, format });
    if (!res.ok) {
      setState({ format, status: "failed", error: res.error });
      return;
    }
    setState({ format, status: "working", id: res.data.exportId });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) =>
        !state || state.status === "ready" || state.status === "failed" ? onClose() : onClose()
      }
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export resume</DialogTitle>
          <DialogDescription>
            Rendering runs as a background job — if it fails your editor state is untouched and you
            can retry.
          </DialogDescription>
        </DialogHeader>
        {!state ? (
          <div className="grid gap-2">
            {EXPORT_FORMATS.map((f) => (
              <button
                key={f.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-accent/50"
                onClick={() => void start(f.id)}
              >
                <f.icon className="size-4 text-primary" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{f.label}</span>
                  <span className="block text-xs text-muted-foreground">{f.hint}</span>
                </span>
                <Download className="ml-auto size-4 text-muted-foreground" aria-hidden />
              </button>
            ))}
          </div>
        ) : state.status === "ready" ? (
          <div className="grid justify-items-center gap-3 py-4 text-center">
            <CheckCircle2 className="size-9 text-success" aria-hidden />
            <p className="text-sm font-medium">Your {state.format.toUpperCase()} is ready</p>
            <Button asChild>
              <a href={`/api/files/exports/${state.id}`} download={state.fileName}>
                <Download /> {state.fileName ?? "Download"}
              </a>
            </Button>
            <button
              className="text-xs text-muted-foreground underline"
              onClick={() => setState(null)}
            >
              Export another format
            </button>
          </div>
        ) : state.status === "failed" ? (
          <div className="grid justify-items-center gap-3 py-4 text-center">
            <AlertTriangle className="size-8 text-destructive" aria-hidden />
            <p className="text-sm">Export failed{state.error ? `: ${state.error}` : "."}</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Your document and editor are unaffected. You can retry, and the reason is in the job
              log.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => state.format && void start(state.format as never)}
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="grid justify-items-center gap-3 py-6 text-sm text-muted-foreground">
            <Spinner className="size-5" /> Rendering {state.format.toUpperCase()}…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────── contact dialog ───────────────────────────────

function ContactDialog({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: ContactForm;
  onSave: (v: ContactForm) => Promise<void>;
}) {
  const [values, setValues] = React.useState<ContactForm>(initial);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) setValues(initial);
  }, [open, initial]);
  const fields: Array<[keyof ContactForm, string, string]> = [
    ["displayName", "Full name", "Printed at the top of every resume"],
    ["headline", "Headline", "e.g. Senior Platform Engineer"],
    ["email", "Email", ""],
    ["phone", "Phone", ""],
    ["location", "Location", "Austin, TX"],
    ["website", "Website", ""],
    ["linkedin", "LinkedIn", ""],
    ["github", "GitHub", ""],
  ];
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Contact details</DialogTitle>
          <DialogDescription>
            These live on your career profile and appear on all resumes. Change here, change
            everywhere.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await onSave(values);
            setBusy(false);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map(([key, label, hint]) => (
              <Field key={key} label={label} hint={hint || undefined}>
                <Input
                  value={(values[key] as string) ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                />
              </Field>
            ))}
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner /> : null} Save contact
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────── publish dialog ───────────────────────────────

function PublishDialog({
  open,
  onClose,
  resumeId,
}: {
  open: boolean;
  onClose: () => void;
  resumeId: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const [url, setUrl] = React.useState<string | null>(null);
  async function toggle(on: boolean) {
    setBusy(true);
    const res = await publishResumeAction({ resumeId, published: on });
    setBusy(false);
    if (res.ok) {
      setUrl(res.data.url);
      toast.success(
        on
          ? "Published — anyone with the link can view (no indexing)."
          : "Unpublished — the link is dead.",
      );
    } else toast.error(res.error);
  }
  return (
    <Dialog open={open} onOpenChange={(v) => (busy ? null : onClose())}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Share a read-only link</DialogTitle>
          <DialogDescription>
            A public view of this resume only — your profile and other resumes stay private. Links
            are unguessable; turn it off any time.
          </DialogDescription>
        </DialogHeader>
        {url ? (
          <div className="grid gap-3">
            <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
            <Button
              variant="secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(url);
                toast.success("Link copied");
              }}
            >
              Copy link
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void toggle(false)}>
              <Rocket /> Take offline
            </Button>
          </div>
        ) : (
          <Button disabled={busy} onClick={() => void toggle(true)}>
            {busy ? <Spinner /> : <Rocket />} Publish
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────── mobile preview ───────────────────────────────

function MobilePreviewFab({ doc }: { doc: ResumeDocument }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg lg:hidden"
        onClick={() => setOpen(true)}
      >
        <Eye className="size-4" /> Preview
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="fixed inset-0 z-50 h-full max-h-full w-full max-w-none -translate-x-0 -translate-y-0 overflow-hidden rounded-none border-0 p-0">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-medium">Preview (matches export)</span>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
            <div className="min-h-0 flex-1 bg-muted/60">
              {open ? <ResumePreview doc={doc} zoom={0.55} /> : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
