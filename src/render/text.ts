import type { RenderDoc, Run } from "@/templates/blocks";

/**
 * Plain-text renderers.
 *  - renderAtsText: linear reading order as ATS parsers typically consume
 *    (header, then main column, then rail; two-column merged) — used by the
 *    "View ATS Text" feature and as fallback for export TXT (§55, §37).
 */

function runsText(runs: Run[]): string {
  return runs.map((r) => r.text).join("").replace(/\s+$/g, "");
}

export function renderAtsText(render: RenderDoc): string {
  const out: string[] = [];
  if (render.header) {
    out.push(render.header.name);
    if (render.header.headlineRuns?.length) out.push(runsText(render.header.headlineRuns));
    const contacts = render.header.contactRuns.map((r) => r.text).join("");
    if (contacts.trim()) out.push(contacts.replace(/\s+•\s+/g, " | "));
  }
  const emitSections = (secs: RenderDoc["main"]) => {
    for (const sec of secs) {
      out.push("", sec.title.toUpperCase(), "");
      for (const b of sec.blocks) {
        switch (b.type) {
          case "paragraph":
            out.push(runsText(b.runs));
            break;
          case "skill-group":
            out.push(`${b.label}: ${b.items.join(", ")}`);
            break;
          case "bullet-list":
            for (const it of b.items) out.push(`  - ${runsText(it)}`);
            break;
          case "entry": {
            const e = b.block;
            const right = e.right ? `    ${e.right}` : "";
            out.push(`${runsText(e.left)}${right}`.replace(/\s+$/g, ""));
            if (e.secondary?.length) out.push(`  ${runsText(e.secondary)}`);
            for (const para of e.paragraphs) out.push(`  ${runsText(para)}`);
            for (const bl of e.bullets) out.push(`  * ${runsText(bl)}`);
            if (e.tags) out.push(`  Tech: ${e.tags}`);
            break;
          }
          case "spacer":
            break;
        }
      }
    }
  };
  if (render.summaryRuns) {
    out.push("", "PROFESSIONAL SUMMARY", "");
    for (const para of render.summaryRuns) out.push(runsText(para));
  }
  emitSections(render.main);
  if (render.columns === 2 && render.rail.length) {
    out.push("", "---- SIDEBAR (appears after main column in linear order) ----");
    emitSections(render.rail);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
