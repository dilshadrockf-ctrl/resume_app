import type { Block, EntryBlock, RenderDoc, RenderSection, Run } from "@/templates/blocks";
import { pdfFontKey } from "@/templates/font-css";

/**
 * Typesetting + pagination shared by the PDF renderer and the live preview, so
 * the preview shows true page breaks. A `Measurer` supplies text widths
 * (fontkit on the server, canvas metrics in the browser); everything else is
 * deterministic and identical on both sides.
 */

export interface Measurer {
  width(text: string, fontKey: string, sizePt: number): number;
}

export interface PlacedRun {
  text: string;
  fontKey: string;
  size: number;
  bold: boolean;
  italic: boolean;
  color?: string;
  link?: string;
}

export interface PlacedLine {
  runs: PlacedRun[];
  width: number;
}

export interface TextBox {
  kind: "text";
  x: number;
  y: number;
  width: number;
  lineHeight: number;
  align: "left" | "right" | "center";
  lines: PlacedLine[];
}

export interface RectBox {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  /** rule = thin line, banner = full-bleed band, rail = sidebar panel */
  role: "rule" | "banner" | "rail" | "bar";
}

export type PlacedItem = TextBox | RectBox;

export interface PlacedPage {
  items: PlacedItem[];
}

export interface PlacedDoc {
  pages: PlacedPage[];
  width: number; // pt
  height: number; // pt
}

export interface TypesetContext {
  baseFont: "inter" | "lora" | "mono";
  accent: string;
  textColor: string;
  fontSize: number;
  lineHeight: number;
  bullet: "dash" | "dot" | "square" | "none";
  page: { width: number; height: number };
  margin: { x: number; y: number };
}

function toCtx(doc: RenderDoc): TypesetContext {
  return {
    baseFont: doc.baseFont,
    accent: doc.accent,
    textColor: doc.textColor,
    fontSize: doc.fontSize,
    lineHeight: doc.lineHeight,
    bullet: doc.bullet,
    page: doc.paperSize === "A4" ? { width: 595.28, height: 841.89 } : { width: 612, height: 792 },
    margin: doc.marginPt,
  };
}

function runToPlaced(run: Run, o: TypesetContext, forceFont?: "inter"): PlacedRun {
  const size = round2(
    Number.isFinite(run.size ?? o.fontSize) ? (run.size ?? o.fontSize) : o.fontSize,
  );
  const text = typeof run.text === "string" ? run.text : String(run.text ?? "");
  const family = (forceFont ? "inter" : o.baseFont) as "inter" | "lora" | "mono";
  return {
    text,
    fontKey: pdfFontKey(family, Boolean(run.bold), Boolean(run.italic)),
    size,
    bold: Boolean(run.bold),
    italic: Boolean(run.italic),
    color: run.color ?? o.textColor,
    link: run.link,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function wrapRuns(
  measurer: Measurer,
  o: TypesetContext,
  runs: Run[],
  maxWidth: number,
): PlacedLine[] {
  const placed = runs.map((r) => runToPlaced(r, o));
  type Piece = { text: string; meta: PlacedRun; hard: boolean; width?: number };
  const pieces: Piece[] = [];
  for (const r of placed) {
    for (const part of r.text.split(/(\s+)/)) {
      if (part === "") continue;
      if (/^\s+$/.test(part)) pieces.push({ text: part, meta: r, hard: false });
      else pieces.push({ text: part, meta: r, hard: true });
    }
  }

  const lines: PlacedLine[] = [];
  let cur: Piece[] = [];
  let curWidth = 0;
  const flush = () => {
    // drop trailing whitespace at a line break
    while (cur.length && /^\s+$/.test(cur[cur.length - 1]!.text)) cur.pop();
    if (!cur.length) return;
    const runsOut: PlacedRun[] = [];
    let width = 0;
    for (const seg of cur) {
      const w = seg.width ?? 0;
      width += w;
      const last = runsOut[runsOut.length - 1];
      const m = seg.meta;
      if (
        last &&
        last.fontKey === m.fontKey &&
        last.size === m.size &&
        last.color === m.color &&
        last.link === m.link
      ) {
        last.text += seg.text;
      } else {
        runsOut.push({ ...m, text: seg.text });
      }
    }
    lines.push({ runs: runsOut, width: Math.min(width, maxWidth) });
    cur = [];
    curWidth = 0;
  };
  for (const piece of pieces) {
    const isSpace = /^\s+$/.test(piece.text);
    // never start a line with whitespace
    if (isSpace && cur.length === 0) continue;
    const w = measurer.width(piece.text, piece.meta.fontKey, piece.meta.size);
    if (piece.hard && curWidth + w > maxWidth && cur.length > 0) {
      flush();
      cur.push({ ...piece, width: w });
      curWidth = w;
      continue;
    }
    cur.push({ ...piece, width: w });
    curWidth += w;
  }
  flush();
  return lines;
}

// Note: Piece carries an extra `width` prop set at push sites above.

interface BlockPlan {
  items: PlacedItem[]; // y relative to block top
  height: number;
}

function planBlock(
  render: RenderDoc,
  o: TypesetContext,
  measurer: Measurer,
  b: Block,
  width: number,
): BlockPlan {
  switch (b.type) {
    case "paragraph": {
      const lines = wrapRuns(measurer, o, b.runs, width);
      const h = lines.length * o.lineHeight + (b.spaceAfter ?? 2);
      return {
        items: [
          {
            kind: "text",
            x: 0,
            y: 0,
            width,
            lineHeight: o.lineHeight,
            align: b.align ?? "left",
            lines,
          },
        ],
        height: h,
      };
    }
    case "skill-group": {
      const runs: Run[] = [{ text: `${b.label}: `, bold: true }, { text: b.items.join(", ") }];
      const lines = wrapRuns(measurer, o, runs, width);
      return {
        items: [
          { kind: "text", x: 0, y: 0, width, lineHeight: o.lineHeight, align: "left", lines },
        ],
        height: lines.length * o.lineHeight + 1.5,
      };
    }
    case "bullet-list": {
      const { items, height } = planBullets(render, o, measurer, b.items, width);
      return { items, height };
    }
    case "entry":
      return planEntry(render, o, measurer, b.block, width);
    case "spacer":
      return { items: [], height: b.size };
  }
}

function bulletChar(o: TypesetContext): string {
  switch (o.bullet) {
    case "dot":
      return "•";
    case "square":
      return "▪";
    case "none":
      return "";
    default:
      return "–";
  }
}

function planBullets(
  render: RenderDoc,
  o: TypesetContext,
  measurer: Measurer,
  items: Run[][],
  width: number,
): BlockPlan {
  const marker = bulletChar(o);
  const indent = marker ? round2(o.fontSize * 1.1) : 0;
  const textWidth = width - indent;
  const out: PlacedItem[] = [];
  let y = 0;
  const gap = round2(o.lineHeight * 0.12);
  for (const itemRuns of items) {
    const lines = wrapRuns(measurer, o, itemRuns, textWidth);
    if (marker) {
      out.push({
        kind: "text",
        x: 0,
        y,
        width: indent,
        lineHeight: o.lineHeight,
        align: "left",
        lines: [
          {
            runs: [runToPlaced({ text: marker, color: o.accent }, o)],
            width: indent,
          },
        ],
      });
    }
    out.push({
      kind: "text",
      x: indent,
      y,
      width: textWidth,
      lineHeight: o.lineHeight,
      align: "left",
      lines,
    });
    y += lines.length * o.lineHeight + gap;
  }
  return { items: out, height: y + 1 };
}

function planEntry(
  render: RenderDoc,
  o: TypesetContext,
  measurer: Measurer,
  entry: EntryBlock,
  width: number,
): BlockPlan {
  const items: PlacedItem[] = [];
  let y = 0;
  const rightBelow = render.layout.datePlacement === "below";
  const dateWidth =
    entry.right && !rightBelow
      ? Math.min(width * 0.34, measureDate(measurer, o, entry.right) + 10)
      : 0;
  const titleWidth = width - dateWidth;

  const titleLines = wrapRuns(measurer, o, entry.left, titleWidth);
  items.push({
    kind: "text",
    x: 0,
    y,
    width: titleWidth,
    lineHeight: o.lineHeight,
    align: "left",
    lines: titleLines,
  });
  const titleBottom = y + titleLines.length * o.lineHeight;

  if (entry.right) {
    const dLines: PlacedLine[] = [
      {
        runs: [runToPlaced({ text: entry.right, size: o.fontSize * 0.92, color: "#6b7280" }, o)],
        width: dateWidth || width,
      },
    ];
    if (rightBelow) {
      items.push({
        kind: "text",
        x: 0,
        y: titleBottom,
        width,
        lineHeight: o.lineHeight * 0.95,
        align: "left",
        lines: dLines,
      });
      y = titleBottom + o.lineHeight * 0.95;
    } else {
      items.push({
        kind: "text",
        x: width - dateWidth,
        y,
        width: dateWidth,
        lineHeight: o.lineHeight,
        align: "right",
        lines: dLines,
      });
      y = Math.max(titleBottom, y + o.lineHeight);
    }
  } else {
    y = titleBottom;
  }

  if (entry.secondary?.length) {
    const sec = entry.secondary.map((r) => ({ ...r, color: r.color ?? "#4b5563" }));
    const lines = wrapRuns(measurer, o, sec, titleWidth);
    items.push({
      kind: "text",
      x: 0,
      y,
      width: titleWidth,
      lineHeight: o.lineHeight * 0.95,
      align: "left",
      lines,
    });
    y += lines.length * o.lineHeight * 0.95;
  }

  for (const para of entry.paragraphs) {
    const lines = wrapRuns(measurer, o, para, width);
    items.push({ kind: "text", x: 0, y, width, lineHeight: o.lineHeight, align: "left", lines });
    y += lines.length * o.lineHeight + 1;
  }

  if (entry.bullets.length) {
    const res = planBullets(render, o, measurer, entry.bullets, width);
    items.push(...res.items.map((it) => ({ ...it, y: it.y + y })));
    y += res.height;
  }

  if (entry.tags) {
    const lines = wrapRuns(
      measurer,
      o,
      [{ text: entry.tags, size: o.fontSize * 0.88, color: "#6b7280", italic: true }],
      width,
    );
    items.push({
      kind: "text",
      x: 0,
      y,
      width,
      lineHeight: o.lineHeight * 0.9,
      align: "left",
      lines,
    });
    y += lines.length * o.lineHeight * 0.9 + 1;
  }

  return { items, height: y + 2 };
}

function measureDate(measurer: Measurer, o: TypesetContext, text: string): number {
  return measurer.width(text, pdfFontKey("inter", false, false), o.fontSize * 0.92);
}

// ────────────────────────── section & unit planning ─────────────────────────

interface SectionUnit {
  items: PlacedItem[];
  height: number;
  keepWithNext: boolean;
}

function planSection(
  render: RenderDoc,
  o: TypesetContext,
  measurer: Measurer,
  sec: RenderSection,
  width: number,
): SectionUnit[] {
  const headingSize = round2(o.fontSize * render.layout.headingSizeScale * 1.03);
  const titleRuns: Run[] = [
    { text: sec.title, bold: true, size: headingSize, color: render.accent },
  ];
  const titleLines = wrapRuns(measurer, o, titleRuns, width);
  const titleLH = headingSize * 1.25;
  const titleH = titleLines.length * titleLH;
  const titleW = titleLines[0]?.width ?? 0;
  const titleX = render.headingAlign === "center" ? Math.max(0, (width - titleW) / 2) : 0;

  const rects: RectBox[] = [];
  let extra = 0;
  const gapAfterTitle = 3;
  if (render.layout.headingRule === "rule") {
    rects.push({
      kind: "rect",
      x: 0,
      y: titleH + gapAfterTitle,
      width,
      height: 0.6,
      color: "#9ca3af",
      role: "rule",
    });
    extra = gapAfterTitle + 0.6 + 6;
  } else if (render.layout.headingRule === "bar") {
    rects.push({
      kind: "rect",
      x: 0,
      y: titleH + gapAfterTitle,
      width,
      height: 1.5,
      color: render.accent,
      role: "bar",
    });
    extra = gapAfterTitle + 1.5 + 6;
  } else if (render.layout.headingRule === "underline") {
    rects.push({
      kind: "rect",
      x: titleX,
      y: titleH + 2,
      width: Math.max(28, Math.min(width, titleW)),
      height: 1.4,
      color: render.accent,
      role: "bar",
    });
    extra = 2 + 1.4 + 6;
  } else {
    extra = 4;
  }

  const titleBox: TextBox = {
    kind: "text",
    x: 0,
    y: 0,
    width,
    lineHeight: titleLH,
    align: render.headingAlign,
    lines: titleLines,
  };

  const units: SectionUnit[] = [];
  const blockPlans = sec.blocks.map((b) => planBlock(render, o, measurer, b, width));
  const gapBetweenBlocks = round2(o.lineHeight * 0.35);
  const gapAfterSection = round2(o.lineHeight * 0.55);
  if (blockPlans.length === 0) {
    units.push({
      items: [titleBox, ...rects],
      height: titleH + extra + gapAfterSection,
      keepWithNext: false,
    });
    return units;
  }
  // Heading always travels with the first block so it can't be orphaned at a page bottom.
  units.push({
    items: [
      titleBox,
      ...rects,
      ...blockPlans[0]!.items.map((it) => ({ ...it, y: it.y + titleH + extra })),
    ],
    height:
      titleH +
      extra +
      blockPlans[0]!.height +
      (blockPlans.length === 1 ? gapAfterSection : gapBetweenBlocks),
    keepWithNext: false,
  });
  for (let i = 1; i < blockPlans.length; i++) {
    const last = i === blockPlans.length - 1;
    units.push({
      items: blockPlans[i]!.items,
      height: blockPlans[i]!.height + (last ? gapAfterSection : gapBetweenBlocks),
      keepWithNext: false,
    });
  }
  return units;
}

// ────────────────────────────── document flow ───────────────────────────────

export function typesetDoc(render: RenderDoc, measurer: Measurer): PlacedDoc {
  const o = toCtx(render);
  const width = o.page.width - 2 * o.margin.x;
  const bottom = o.page.height - o.margin.y;

  const pages: PlacedPage[] = [{ items: [] }];
  let cursorY = o.margin.y;

  // Header ----------------------------------------------------------------
  if (render.header) {
    const h = render.header;
    const isBanner = h.variant === "banner";
    const nameSize = round2(o.fontSize * (isBanner ? 2.3 : h.variant === "centered" ? 2.2 : 2.0));
    const nameLines = wrapRuns(
      measurer,
      { ...o, textColor: isBanner ? "#ffffff" : o.textColor },
      [{ text: h.name, bold: true, size: nameSize }],
      width,
    );
    const headerItems: PlacedItem[] = [];
    let hy = 0;
    headerItems.push({
      kind: "text",
      x: 0,
      y: 0,
      width,
      lineHeight: nameSize * 1.16,
      align: h.align,
      lines: nameLines,
    });
    hy += nameLines.length * nameSize * 1.16 + 2;
    if (h.headlineRuns) {
      const hl = wrapRuns(measurer, o, h.headlineRuns, width);
      headerItems.push({
        kind: "text",
        x: 0,
        y: hy + 1,
        width,
        lineHeight: o.lineHeight * 1.1,
        align: h.align,
        lines: hl,
      });
      hy += hl.length * o.lineHeight * 1.1 + 4;
    }
    if (h.contactRuns.length) {
      const cl = wrapRuns(measurer, o, h.contactRuns, width);
      headerItems.push({
        kind: "text",
        x: 0,
        y: hy + 2,
        width,
        lineHeight: o.lineHeight * 1.0,
        align: h.align,
        lines: cl,
      });
      hy += cl.length * o.lineHeight * 1.0 + 4;
    }
    if (isBanner) {
      const pad = 22;
      const bannerH = hy + pad * 2;
      pages[0]!.items.push({
        kind: "rect",
        x: 0,
        y: 0,
        width: o.page.width,
        height: bannerH,
        color: o.accent,
        role: "banner",
      });
      for (const it of headerItems) {
        it.y += pad;
        it.x += o.margin.x;
        if (it.kind === "text")
          for (const ln of it.lines) for (const r of ln.runs) r.color = "#ffffff";
      }
      pages[0]!.items.push(...headerItems);
      cursorY = bannerH + 18;
    } else {
      for (const it of headerItems) {
        it.y += cursorY;
        it.x += o.margin.x;
      }
      pages[0]!.items.push(...headerItems);
      cursorY += hy + 6;
      pages[0]!.items.push({
        kind: "rect",
        x: o.margin.x,
        y: cursorY,
        width,
        height: h.variant === "stacked" ? 2 : 0.8,
        color: o.accent,
        role: "rule",
      });
      cursorY += 14;
    }
  }

  const summaryAsSection: RenderSection | null = render.summaryRuns
    ? {
        kind: "SUMMARY",
        title:
          render.layout.headingCase === "uppercase"
            ? "PROFESSIONAL SUMMARY"
            : "Professional Summary",
        blocks: render.summaryRuns.map(
          (runs) => ({ type: "paragraph", runs, spaceAfter: 0 }) as Block,
        ),
      }
    : null;

  const mainUnits: SectionUnit[] = [];
  const railUnits: SectionUnit[] = [];
  const pushUnits = (secs: RenderSection[], width_: number, sink: SectionUnit[]) => {
    for (const sec of secs) sink.push(...planSection(render, o, measurer, sec, width_));
  };

  const oneCol = render.columns === 1;
  const railPad = oneCol ? 0 : 14; // inner padding of the tinted rail panel
  const railWidth = oneCol ? 0 : round2(width * 0.3);
  const railGap = oneCol ? 0 : 18 + railPad;
  const mainWidth = oneCol ? width : round2(width - railWidth - railGap);

  const mainSecs: RenderSection[] = [];
  if (summaryAsSection && (oneCol || !render.layout.rail.includes("SUMMARY")))
    mainSecs.push(summaryAsSection);
  mainSecs.push(...render.main);
  pushUnits(mainSecs, mainWidth, mainUnits);
  pushUnits(render.rail, railWidth, railUnits);

  // Rail background first so main flow can start on page 1
  const railStartX = o.margin.x + mainWidth + railGap;
  const railBgRect = (): RectBox => ({
    kind: "rect",
    x: railStartX - railPad,
    y: 0,
    width: railWidth + railPad + o.margin.x,
    height: o.page.height,
    color: render.railBg ?? "#f3f4f6",
    role: "rail",
  });
  if (!oneCol && render.railBg) pages[0]!.items.unshift(railBgRect());

  const flow = (
    units: SectionUnit[],
    colX: number,
    colWidth: number,
    startY: number,
    pageBg?: () => PlacedItem | null,
  ) => {
    let y = startY;
    let pageIndex = 0;
    for (let i = 0; i < units.length; i++) {
      const unit = units[i]!;
      if (y + unit.height > bottom && y > startY - 0.001) {
        pageIndex++;
        while (!pages[pageIndex]) {
          const np: PlacedPage = { items: [] };
          if (pageBg) {
            const bg = pageBg();
            if (bg) np.items.push(bg);
          }
          pages.push(np);
        }
        y = o.margin.y;
      }
      for (const it of unit.items) {
        pages[pageIndex]!.items.push({ ...it, x: it.x + colX, y: it.y + y } as PlacedItem);
      }
      y += unit.height;
    }
    return y;
  };

  const bgFactory = !oneCol && render.railBg ? railBgRect : undefined;

  flow(mainUnits, o.margin.x, mainWidth, cursorY, bgFactory);
  if (!oneCol && railUnits.length) {
    // rail starts level with the main column (below the header/banner)
    flow(railUnits, railStartX, railWidth, cursorY);
  }

  // Trim pages whose only content is background rects
  const cleaned = pages.filter((p) =>
    p.items.some(
      (it) => it.kind === "text" && it.lines.some((l) => l.runs.some((r) => r.text.trim())),
    ),
  );
  return {
    pages: cleaned.length
      ? cleaned
      : [
          {
            items: [
              {
                kind: "text",
                x: 0,
                y: 0,
                width: 0,
                lineHeight: 0,
                align: "left",
                lines: [
                  {
                    runs: [
                      {
                        text: "",
                        fontKey: pdfFontKey("inter", false, false),
                        size: 10,
                        bold: false,
                        italic: false,
                      },
                    ],
                    width: 0,
                  },
                ],
              },
            ],
          },
        ],
    width: o.page.width,
    height: o.page.height,
  };
}

export function estimatePageCount(render: RenderDoc, measurer: Measurer): number {
  return typesetDoc(render, measurer).pages.length;
}
