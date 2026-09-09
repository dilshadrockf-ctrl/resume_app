"use client";
import * as React from "react";
import { ChevronDown, Eye, EyeOff, GripVertical, Trash2, Plus } from "lucide-react";
import type { SectionItem } from "@/lib/resume/document";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/overlays";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { itemTitle, type LibraryKindKey } from "@/features/profile/entry-map";

/** Edit one section item. `onChange` receives a patch merged over the item. */

export function ItemCard({
  item,
  index,
  count,
  onChange,
  onRemove,
  onMove,
  hideControls,
  defaultOpen = false,
}: {
  item: SectionItem;
  index: number;
  count: number;
  onChange: (patch: Partial<SectionItem>) => void;
  onRemove: () => void;
  onMove: (to: number) => void;
  hideControls?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const title = itemTitle(item.kind, item) || "Untitled";
  return (
    <div
      className={cn(
        "group rounded-lg border bg-card transition-shadow",
        !item.visible && "opacity-55",
      )}
      data-item-index={index}
    >
      <div className="flex items-center gap-1 px-2 py-1.5">
        {!hideControls ? (
          <span
            className="cursor-grab text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden
          >
            <GripVertical className="size-4" />
          </span>
        ) : null}
        <button
          className="min-w-0 flex-1 truncate px-1 text-left text-sm font-medium hover:underline"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {title}
          <ChevronDown
            className={cn(
              "ml-1 inline size-3.5 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        {!hideControls ? (
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move up"
              disabled={index === 0}
              onClick={() => onMove(index - 1)}
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move down"
              disabled={index === count - 1}
              onClick={() => onMove(index + 1)}
            >
              ↓
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={item.visible ? "Hide from this resume" : "Show on resume"}
              title={
                item.visible
                  ? "Hide from this resume (stays in your career profile)"
                  : "Show on resume"
              }
              onClick={() => onChange({ visible: !item.visible } as Partial<SectionItem>)}
            >
              {item.visible ? <Eye /> : <EyeOff />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Remove from resume"
              title="Removes from this resume only — your career profile keeps it"
              onClick={onRemove}
            >
              <Trash2 className="text-destructive" />
            </Button>
          </div>
        ) : null}
      </div>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleContent>
          <div className="border-t px-3 py-3">
            <ItemFields item={item} onChange={onChange} />
            <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
              Edits here update your shared career profile too — every resume using this entry sees
              the change.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function ItemFields({
  item,
  onChange,
}: {
  item: SectionItem;
  onChange: (p: Partial<SectionItem>) => void;
}) {
  const i = item as unknown as Record<string, unknown>;
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ [key]: e.target.value } as Partial<SectionItem>);
  const text = (key: string, label: string, placeholder?: string) => (
    <Field key={key} label={label}>
      <Input value={String(i[key] ?? "")} onChange={set(key)} placeholder={placeholder} />
    </Field>
  );
  const area = (key: string, label: string, rows = 3) => (
    <Field key={key} label={label}>
      <Textarea value={String(i[key] ?? "")} onChange={set(key)} rows={rows} />
    </Field>
  );

  switch (item.kind) {
    case "experience":
      return (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {text("title", "Role")}
            {text("employer", "Company")}
            {text("location", "Location")}
            <Field label="Type">
              <select
                className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
                value={String(i.employmentType ?? "FULL_TIME")}
                onChange={(e) => onChange({ employmentType: e.target.value } as never)}
              >
                {[
                  "FULL_TIME",
                  "PART_TIME",
                  "CONTRACT",
                  "INTERNSHIP",
                  "FREELANCE",
                  "SELF_EMPLOYED",
                ].map((t) => (
                  <option key={t} value={t}>
                    {t
                      .replaceAll("_", " ")
                      .toLowerCase()
                      .replace(/^./, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </Field>
            {text("startDate", "Start", "2022-03")}
            {text("endDate", "End", "2024-08")}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              checked={Boolean(i.current)}
              onChange={(e) => onChange({ current: e.target.checked } as never)}
            />
            I currently work here
          </label>
          <BulletsField
            value={(i.bullets as string[]) ?? []}
            onChange={(v) => onChange({ bullets: v } as never)}
            achievements={(i.achievements as string[]) ?? []}
            onAchievements={(v) => onChange({ achievements: v } as never)}
          />
          {area("description", "Notes (optional)")}
          <TagsField
            label="Technologies"
            value={(i.technologies as string[]) ?? []}
            onChange={(v) => onChange({ technologies: v } as never)}
          />
        </div>
      );
    case "education":
      return (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {text("institution", "School")}
            {text("degree", "Degree")}
            {text("field", "Field of study")}
            {text("location", "Location")}
            {text("startDate", "Start", "2016")}
            {text("endDate", "End", "2020")}
            {text("gpa", "GPA")}
            {text("honors", "Honors")}
          </div>
          {area("description", "Notes (optional)")}
        </div>
      );
    case "project":
      return (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {text("name", "Name")}
            {text("role", "Your role")}
            {text("url", "URL")}
            {text("startDate", "Start")}
            {text("endDate", "End")}
          </div>
          <BulletsField
            value={(i.bullets as string[]) ?? []}
            onChange={(v) => onChange({ bullets: v } as never)}
          />
          {area("description", "Description")}
          <TagsField
            label="Tech"
            value={(i.technologies as string[]) ?? []}
            onChange={(v) => onChange({ technologies: v } as never)}
          />
        </div>
      );
    case "skill":
      return (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {text("name", "Skill")}
            <Field label="Category">
              <select
                className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
                value={String(i.category ?? "OTHER")}
                onChange={(e) => onChange({ category: e.target.value } as never)}
              >
                {[
                  "PROGRAMMING",
                  "TECHNICAL",
                  "CLOUD",
                  "TOOL",
                  "SOFT",
                  "LANGUAGE_SKILL",
                  "CERTIFICATION_SKILL",
                  "OTHER",
                ].map((c) => (
                  <option key={c} value={c}>
                    {c
                      .replaceAll("_", " ")
                      .toLowerCase()
                      .replace(/^./, (ch) => ch.toUpperCase())}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <TagsField
            label="Keywords (for ATS matching)"
            value={(i.keywords as string[]) ?? []}
            onChange={(v) => onChange({ keywords: v } as never)}
          />
        </div>
      );
    case "certification":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {text("name", "Name")}
          {text("issuer", "Issuer")}
          {text("credentialId", "Credential ID")}
          {text("url", "Verify URL")}
          {text("issueDate", "Issued", "2024-05")}
          {text("expiryDate", "Expires")}
        </div>
      );
    case "award":
      return (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {text("title", "Award")}
            {text("issuer", "Issuer")}
            {text("date", "Date")}
          </div>
          {area("blurb", "Description")}
        </div>
      );
    case "publication":
      return (
        <div className="grid gap-3">
          {text("title", "Title")}
          <div className="grid gap-3 sm:grid-cols-3">
            {text("publisher", "Publisher / Venue")}
            {text("date", "Date")}
            {text("url", "URL")}
          </div>
          <TagsField
            label="Authors"
            value={(i.authors as string[]) ?? []}
            onChange={(v) => onChange({ authors: v } as never)}
          />
          {area("blurb", "Abstract / notes")}
        </div>
      );
    case "language":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {text("name", "Language")}
          {text("proficiency", "Proficiency", "Native · C1 · Professional")}
        </div>
      );
    case "volunteer":
      return (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {text("role", "Role")}
            {text("organization", "Organization")}
            {text("location", "Location")}
            {text("startDate", "Start")}
            {text("endDate", "End")}
          </div>
          <BulletsField
            value={(i.bullets as string[]) ?? []}
            onChange={(v) => onChange({ bullets: v } as never)}
          />
        </div>
      );
    case "custom":
      return (
        <div className="grid gap-3">
          {text("title", "Heading")}
          <Field label="One entry per line">
            <Textarea
              rows={4}
              value={((i.items as string[]) ?? []).join("\n")}
              onChange={(e) =>
                onChange({
                  items: e.target.value
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean),
                } as never)
              }
            />
          </Field>
        </div>
      );
  }
}

/** Bullets: plain textarea, one bullet per line — zero magic, nothing lost. */
export function BulletsField({
  value,
  onChange,
  achievements,
  onAchievements,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  achievements?: string[];
  onAchievements?: (v: string[]) => void;
}) {
  return (
    <div className="grid gap-3">
      <Field label="Bullets" hint="One per line. Lead with a verb, end with a number.">
        <BulletLines value={value} onChange={onChange} />
      </Field>
      {achievements !== undefined && onAchievements ? (
        <Field
          label="Achievements"
          hint="Optional — rendered with a ★ when the template supports it."
        >
          <BulletLines
            value={achievements}
            onChange={onAchievements}
            placeholder="Won internal hackathon among 40 teams"
          />
        </Field>
      ) : null}
    </div>
  );
}

function BulletLines({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const lines = value.join("\n");
  const [local, setLocal] = React.useState(lines);
  React.useEffect(() => setLocal(lines), [lines]);
  return (
    <Textarea
      rows={Math.max(3, Math.min(12, value.length + 1))}
      placeholder={placeholder ?? "Reduced deploy time 70% by containerizing build pipeline"}
      value={local}
      onChange={(e) => {
        setLocal(e.target.value);
        onChange(
          e.target.value
            .split("\n")
            .map((l) => l.replace(/^[-*•]\s*/, "").trimEnd())
            .filter((l, idx, arr) => (l.length > 0 || idx < arr.length - 1 ? l.length > 0 : false)),
        );
      }}
      onBlur={() =>
        onChange(
          local
            .split("\n")
            .map((l) => l.replace(/^[-*•]\s*/, "").trim())
            .filter(Boolean),
        )
      }
    />
  );
}

export function TagsField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = React.useState("");
  return (
    <Field label={label} hint="Comma separated.">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-card p-1.5">
        {value.map((t, i) => (
          <span
            key={`${t}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
          >
            {t}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${t}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          placeholder={value.length ? "" : "Type and press Enter"}
        />
      </div>
    </Field>
  );
  function commit() {
    const parts = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))]);
    setDraft("");
  }
}

export function AddItemButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="justify-start">
      <Plus className="size-3.5" /> {label}
    </Button>
  );
}

export type { LibraryKindKey };
