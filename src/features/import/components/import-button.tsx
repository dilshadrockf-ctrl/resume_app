"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { requestImportAction, importStatusAction } from "@/features/import/actions";

/** Upload a PDF/DOCX/TXT/MD; parsing runs in the queue, we poll to review. */
export function ImportResumeButton({ label = "Import" }: { label?: string }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState("");

  async function onFile(file: File) {
    setBusy(true);
    setNote("reading file…");
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < buf.length; i += CHUNK)
        bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
      const res = await requestImportAction({
        name: file.name,
        mime: file.type || "application/octet-stream",
        dataBase64: btoa(bin),
      });
      if (!res.ok) {
        toast.error(res.error);
        setBusy(false);
        setNote("");
        return;
      }
      setNote("parsing in queue…");
      const started = Date.now();
      for (let tick = 0; tick < 80; tick++) {
        await new Promise((r) => setTimeout(r, 750));
        const st = await importStatusAction({ importId: res.data.importId });
        if (!st.ok) break;
        if (st.data.status === "NEEDS_REVIEW" && st.data.resumeId) {
          toast.success(
            "Imported — everything you see is exactly what was in your file. Please review it.",
            {
              description: "Sections were placed by headings alone; nothing was rewritten.",
            },
          );
          router.push(`/resumes/${st.data.resumeId}`);
          setBusy(false);
          setNote("");
          return;
        }
        if (st.data.status === "FAILED") {
          toast.error("Import failed", {
            description: st.data.error ?? "Your existing resumes are untouched.",
          });
          setBusy(false);
          setNote("");
          return;
        }
        if (Date.now() - started > 60_000) break;
      }
      toast.error("Import is taking longer than expected — it keeps running in the queue.", {
        description: "Check this list again shortly; no data was lost.",
      });
    } catch {
      toast.error("Import failed — existing data untouched.");
    }
    setBusy(false);
    setNote("");
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />
      <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Spinner /> : <FileUp />} {busy && note ? note : label}
      </Button>
    </>
  );
}
