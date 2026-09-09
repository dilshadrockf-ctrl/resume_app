"use client";
import * as React from "react";
import type { ResumeDocument } from "@/lib/resume/document";
import { buildRenderDoc } from "@/templates/blocks";
import { typesetDoc } from "@/templates/typeset";
import { placedDocToHtml } from "@/templates/preview-html";
import { createDomMeasurer } from "@/templates/measure-dom";
import { resolveConfig } from "@/templates/catalog";
import { sampleResumeDocument } from "@/templates/sample";

/**
 * Small live thumbnail of a template. Uses the same block builder, typesetter
 * and HTML painter as the full preview, at page-1 only and a fixed width.
 * Falls back to the sample document when the resume has no content yet.
 */
export function TemplateThumb({
  doc,
  templateId,
  width,
}: {
  doc: ResumeDocument | null;
  templateId: string;
  width: number;
}) {
  const [html, setHtml] = React.useState<{ html: string; scale: number; h: number } | null>(null);

  React.useEffect(() => {
    let alive = true;
    const id = window.setTimeout(() => {
      try {
        const base = doc && hasContent(doc) ? doc : sampleResumeDocument();
        const d: ResumeDocument = {
          ...base,
          meta: { ...base.meta, templateId, config: resolveConfig(templateId, {}) },
        };
        const render = buildRenderDoc(d);
        const placed = typesetDoc(render, createDomMeasurer(96 / 72));
        placed.pages = placed.pages.slice(0, 1);
        const pxPerPt = 96 / 72;
        const out = placedDocToHtml(placed, { pxPerPt });
        if (!alive) return;
        const scale = width / out.widthPx;
        setHtml({ html: out.html, scale, h: out.heightPx * scale });
      } catch (e) {
        console.error("thumb failed", e);
      }
    }, 30);
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [doc, templateId, width]);

  const ratio = doc?.meta.paperSize === "LETTER" ? 792 / 612 : 841.89 / 595.28;
  return (
    <div
      className="relative overflow-hidden bg-white"
      style={{ width, height: Math.round(width * ratio) }}
      aria-hidden
    >
      {html ? (
        <div
          style={{ transform: `scale(${html.scale})`, transformOrigin: "top left" }}
          dangerouslySetInnerHTML={{ __html: html.html }}
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-muted/40" />
      )}
    </div>
  );
}

function hasContent(doc: ResumeDocument): boolean {
  if (doc.summary.trim()) return true;
  return doc.sections.some((s) => s.items.some((i) => i.visible));
}
