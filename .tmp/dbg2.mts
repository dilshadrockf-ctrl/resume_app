import { emptyResumeDocument } from "../src/lib/resume/document.ts";
import { buildRenderDoc } from "../src/templates/blocks.ts";
const doc = emptyResumeDocument("T");
console.log("config:", JSON.stringify(doc.meta.config).slice(0, 200));
const r = buildRenderDoc(doc);
console.log({ fontSize: r.fontSize, lineHeight: r.lineHeight, margin: r.marginPt, cols: r.columns });
