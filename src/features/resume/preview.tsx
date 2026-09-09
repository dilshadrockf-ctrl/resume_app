"use client";
import * as React from "react";
import type { ResumeDocument } from "@/lib/resume/document";
import { buildRenderDoc } from "@/templates/blocks";
import { typesetDoc } from "@/templates/typeset";
import { placedDocToHtml } from "@/templates/preview-html";
import { createDomMeasurer, ensureFontsLoaded } from "@/templates/measure-dom";
import { Spinner } from "@/components/ui/primitives";
import { getTemplate } from "@/templates/catalog";

/**
 * Live preview: buildRenderDoc → typesetDoc → positioned HTML, driven by the
 * identical paginator the PDF export uses — page breaks here are page breaks
 * in the file (WYSIWYG).
 */

export interface PreviewHandle {
  pages: number;
}

export function ResumePreview({
  doc,
  zoom = 1,
  onMeta,
}: {
  doc: ResumeDocument;
  zoom?: number;
  onMeta?: (meta: { pages: number; widthPx: number }) => void;
}) {
  const [fontsReady, setFontsReady] = React.useState(false);
  const [html, setHtml] = React.useState<string>("");
  const [meta, setMeta] = React.useState({ widthPx: 816, heightPx: 1056, pages: 1 });
  const [rendering, setRendering] = React.useState(true);
  const boxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let alive = true;
    void ensureFontsLoaded().then(() => {
      if (alive) setFontsReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    let alive = true;
    // async chunk so typing never blocks the frame
    const t = setTimeout(() => {
      try {
        const render = buildRenderDoc(doc);
        const measurer = createDomMeasurer(96 / 72);
        const placed = typesetDoc(render, measurer);
        const out = placedDocToHtml(placed, { pxPerPt: (96 / 72) * zoom });
        if (!alive) return;
        setHtml(out.html);
        setMeta({ widthPx: out.widthPx, heightPx: out.heightPx, pages: out.pages });
        setRendering(false);
      } catch (e) {
        if (!alive) return;
        console.error("preview failed", e);
        setRendering(false);
      }
    }, 60);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [doc, zoom, fontsReady]);

  React.useEffect(() => {
    onMeta?.({ pages: meta.pages, widthPx: meta.widthPx });
  }, [meta, onMeta]);

  return (
    <div ref={boxRef} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto p-4" id="resume-print-area">
        {html ? (
          <div
            style={{ width: meta.widthPx, margin: "0 auto" }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="flex h-[400px] items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner /> {rendering ? "Typesetting…" : "Nothing to preview yet"}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t px-4 py-1.5 text-[11px] text-muted-foreground">
        <span>
          {meta.pages} page{meta.pages === 1 ? "" : "s"} · {doc.meta.paperSize} ·{" "}
          {getTemplate(doc.meta.templateId).name}
        </span>
        <span>Preview matches export (same paginator)</span>
      </div>
    </div>
  );
}
