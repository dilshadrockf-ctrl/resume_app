"use client";
import * as React from "react";
import { Check, LayoutTemplate, Palette, SlidersHorizontal } from "lucide-react";
import type { ResumeDocument, TemplateConfig } from "@/lib/resume/document";
import { TEMPLATES, getTemplate, resolveConfig } from "@/templates/catalog";
import { Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";
import { TemplateThumb } from "@/features/resume/template-thumb";

/**
 * Design controls for the preview column: template picker with live
 * thumbnails plus the presentation knobs (colour, type, spacing, layout).
 * Everything here is presentation only — content is never touched.
 */

const ACCENTS = [
  "#111827",
  "#1d4ed8",
  "#0e7490",
  "#047857",
  "#0f3d3e",
  "#7c3aed",
  "#b45309",
  "#be123c",
  "#1e3a8a",
  "#44403c",
];

export function DesignPanel({
  doc,
  onChangeConfig,
  onTemplate,
  onPaper,
}: {
  doc: ResumeDocument;
  onChangeConfig: (p: Partial<TemplateConfig>) => void;
  onTemplate: (id: string) => void;
  onPaper: (p: "A4" | "LETTER") => void;
}) {
  const cfg = resolveConfig(doc.meta.templateId, doc.meta.config);
  const template = getTemplate(doc.meta.templateId);
  const [tab, setTab] = React.useState<"templates" | "style">("templates");

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-l bg-card">
      <div className="grid grid-cols-2 border-b p-1.5 text-xs">
        <button
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium",
            tab === "templates" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
          )}
          onClick={() => setTab("templates")}
        >
          <LayoutTemplate className="size-3.5" /> Templates
        </button>
        <button
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium",
            tab === "style" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
          )}
          onClick={() => setTab("style")}
        >
          <SlidersHorizontal className="size-3.5" /> Style
        </button>
      </div>

      {tab === "templates" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATES.map((t) => {
              const current = t.id === doc.meta.templateId;
              return (
                <button
                  key={t.id}
                  onClick={() => !current && onTemplate(t.id)}
                  className={cn(
                    "group flex flex-col gap-1.5 rounded-lg border p-1.5 text-left transition-all hover:border-primary/60 hover:shadow-sm",
                    current && "border-primary ring-2 ring-primary/30",
                  )}
                  title={t.description}
                >
                  <div className="relative overflow-hidden rounded-md border bg-white">
                    <TemplateThumb doc={doc} templateId={t.id} width={104} />
                    {current ? (
                      <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-2.5" />
                      </span>
                    ) : null}
                  </div>
                  <div className="px-0.5">
                    <div className="truncate text-[11px] font-semibold leading-tight">{t.name}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      ATS {t.ats}
                      {t.layout.columns === 2 ? " · 2 col" : ""}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            {template.description}
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 text-xs">
          <Group label="Accent colour">
            <div className="flex flex-wrap gap-1.5">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  aria-label={`Accent ${c}`}
                  onClick={() => onChangeConfig({ accentColor: c })}
                  className={cn(
                    "size-6 rounded-full border border-black/10 transition-transform hover:scale-110",
                    cfg.accentColor.toLowerCase() === c && "ring-2 ring-primary ring-offset-2",
                  )}
                  style={{ background: c }}
                />
              ))}
              <label
                className="grid size-6 cursor-pointer place-items-center rounded-full border border-dashed text-muted-foreground"
                title="Custom colour"
              >
                <Palette className="size-3" />
                <input
                  type="color"
                  className="sr-only"
                  value={cfg.accentColor}
                  onChange={(e) => onChangeConfig({ accentColor: e.target.value })}
                />
              </label>
            </div>
          </Group>

          <Group label="Font">
            <Segmented
              value={cfg.baseFont}
              onChange={(v) => onChangeConfig({ baseFont: v as TemplateConfig["baseFont"] })}
              options={[
                { value: "inter", label: "Inter", style: { fontFamily: "Inter, sans-serif" } },
                { value: "lora", label: "Lora", style: { fontFamily: "Lora, serif" } },
                {
                  value: "mono",
                  label: "Mono",
                  style: { fontFamily: "'JetBrains Mono', monospace" },
                },
              ]}
            />
          </Group>

          <Group label={`Font size · ${cfg.fontSize}pt`}>
            <input
              type="range"
              min={8}
              max={13}
              step={0.5}
              value={cfg.fontSize}
              onChange={(e) => onChangeConfig({ fontSize: Number(e.target.value) })}
              className="w-full accent-[var(--primary)]"
            />
          </Group>
          <Group label={`Line height · ${cfg.lineHeight.toFixed(2)}`}>
            <input
              type="range"
              min={1.1}
              max={1.7}
              step={0.02}
              value={cfg.lineHeight}
              onChange={(e) => onChangeConfig({ lineHeight: Number(e.target.value) })}
              className="w-full accent-[var(--primary)]"
            />
          </Group>
          <Group label="Margins">
            <input
              type="range"
              min={0.6}
              max={1.4}
              step={0.05}
              value={cfg.marginScale}
              onChange={(e) => onChangeConfig({ marginScale: Number(e.target.value) })}
              className="w-full accent-[var(--primary)]"
              title="Higher = narrower margins"
            />
          </Group>
          <Group label="Density">
            <Segmented
              value={cfg.density}
              onChange={(v) => onChangeConfig({ density: v as TemplateConfig["density"] })}
              options={[
                { value: "comfortable", label: "Airy" },
                { value: "compact", label: "Normal" },
                { value: "dense", label: "Tight" },
              ]}
            />
          </Group>

          <Group label="Section dividers">
            <Segmented
              value={cfg.sectionDivider ?? template.layout.headingRule}
              onChange={(v) =>
                onChangeConfig({ sectionDivider: v as TemplateConfig["sectionDivider"] })
              }
              options={[
                { value: "rule", label: "Line" },
                { value: "bar", label: "Bar" },
                { value: "underline", label: "Under" },
                { value: "space", label: "None" },
              ]}
            />
          </Group>
          <Group label="Headings">
            <Segmented
              value={
                (cfg.uppercaseHeadings ?? template.layout.headingCase === "uppercase")
                  ? "upper"
                  : "title"
              }
              onChange={(v) => onChangeConfig({ uppercaseHeadings: v === "upper" })}
              options={[
                { value: "upper", label: "UPPERCASE" },
                { value: "title", label: "Title Case" },
              ]}
            />
          </Group>
          <Group label="Header">
            <Segmented
              value={cfg.headerStyle ?? template.layout.header}
              onChange={(v) => onChangeConfig({ headerStyle: v as TemplateConfig["headerStyle"] })}
              options={[
                { value: "left", label: "Left" },
                { value: "centered", label: "Centred" },
                { value: "banner", label: "Banner" },
              ]}
            />
          </Group>
          <Group label="Dates">
            <Segmented
              value={cfg.dateAlign ?? template.layout.datePlacement}
              onChange={(v) => onChangeConfig({ dateAlign: v as TemplateConfig["dateAlign"] })}
              options={[
                { value: "right", label: "Right-aligned" },
                { value: "below", label: "Below title" },
              ]}
            />
          </Group>
          <Group label="Bullets">
            <Segmented
              value={cfg.bulletStyle}
              onChange={(v) => onChangeConfig({ bulletStyle: v as TemplateConfig["bulletStyle"] })}
              options={[
                { value: "dot", label: "•" },
                { value: "dash", label: "–" },
                { value: "square", label: "▪" },
                { value: "none", label: "None" },
              ]}
            />
          </Group>
          <Group label="Skills layout">
            <Segmented
              value={cfg.skillFormat}
              onChange={(v) => onChangeConfig({ skillFormat: v as TemplateConfig["skillFormat"] })}
              options={[
                { value: "inline", label: "One line" },
                { value: "grouped-inline", label: "By group" },
              ]}
            />
          </Group>
          <Group label="Paper">
            <Segmented
              value={doc.meta.paperSize}
              onChange={(v) => onPaper(v as "A4" | "LETTER")}
              options={[
                { value: "A4", label: "A4" },
                { value: "LETTER", label: "US Letter" },
              ]}
            />
          </Group>
          <div className="flex items-center justify-between rounded-lg border p-2">
            <div>
              <div className="font-medium">ATS-safe mode</div>
              <div className="text-[10px] text-muted-foreground">
                Single column, plain headings, black text.
              </div>
            </div>
            <input
              type="checkbox"
              checked={cfg.atsSafe}
              onChange={(e) => onChangeConfig({ atsSafe: e.target.checked })}
              className="size-4 accent-[var(--primary)]"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onChangeConfig(resolveConfig(doc.meta.templateId, {}))}
          >
            Reset to template defaults
          </Button>
        </div>
      )}
    </aside>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 font-medium text-foreground/80">{label}</div>
      {children}
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; style?: React.CSSProperties }[];
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={o.style}
          className={cn(
            "truncate rounded-md px-1.5 py-1 text-[11px] transition-colors",
            value === o.value
              ? "bg-card font-semibold shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TemplateBadge({ id }: { id: string }) {
  const t = getTemplate(id);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {t.name} <Badge variant="outline">ATS {t.ats}</Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-xs">{t.description}</PopoverContent>
    </Popover>
  );
}
