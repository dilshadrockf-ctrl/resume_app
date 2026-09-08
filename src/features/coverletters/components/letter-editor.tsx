"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Field, Input, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { saveLetterAction } from "@/features/coverletters/actions";

export function LetterEditor({
  letter,
}: {
  letter: {
    id: string;
    company: string;
    role: string;
    hiringManager: string | null;
    content: string;
    status: string;
    tone: string;
    length: string;
  };
}) {
  const router = useRouter();
  const [content, setContent] = React.useState(letter.content);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const dirtyRef = React.useRef(false);
  const inFlight = React.useRef<Promise<unknown>>(Promise.resolve());
  const contentRef = React.useRef(content);
  contentRef.current = content;

  React.useEffect(() => {
    const t = setInterval(async () => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      await inFlight.current;
      inFlight.current = saveLetterAction({ id: letter.id, content: contentRef.current }).then(
        (r) => {
          if (r.ok) setSavedAt(new Date().toLocaleTimeString());
          else toast.error(r.error);
        },
      );
    }, 1500);
    return () => clearInterval(t);
  }, [letter.id]);

  const statusBadge =
    letter.status === "SENT" ? "sent" : letter.status === "FINAL" ? "final" : "draft";

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Company">
          <Input
            defaultValue={letter.company}
            onBlur={async (e) => {
              await saveLetterAction({
                id: letter.id,
                content: contentRef.current,
                ...(e.target.value ? ({ company: e.target.value } as never) : {}),
              });
              router.refresh();
            }}
          />
        </Field>
        <Field label="Role">
          <Input
            defaultValue={letter.role}
            onBlur={async (e) => {
              await saveLetterAction({
                id: letter.id,
                content: contentRef.current,
                ...(e.target.value ? ({ role: e.target.value } as never) : {}),
              });
              router.refresh();
            }}
          />
        </Field>
        <Field label="Hiring manager" hint="only if you actually know it">
          <Input
            defaultValue={letter.hiringManager ?? ""}
            placeholder="Hiring Manager"
            onBlur={async (e) => {
              await saveLetterAction({
                id: letter.id,
                content: contentRef.current,
                ...(e.target.value ? ({ hiringManager: e.target.value } as never) : {}),
              });
              router.refresh();
            }}
          />
        </Field>
      </div>
      <Textarea
        rows={22}
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          dirtyRef.current = true;
        }}
        className="font-serif text-[15px] leading-7"
        aria-label="Cover letter text"
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={letter.status === "SENT" ? "success" : "muted"}>{statusBadge}</Badge>
        <span className="text-xs text-muted-foreground">
          {savedAt ? `saved ${savedAt}` : "auto-saves as you type"} · tone:{" "}
          {letter.tone.toLowerCase()} · length: {letter.length.toLowerCase()}
        </span>
        <span className="flex-1" />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(content);
            toast.success("Copied as plain text — it will paste cleanly anywhere.");
          }}
        >
          <Copy /> Copy
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await saveLetterAction({ id: letter.id, content, status: "FINAL" });
            toast.success("Marked final.");
            router.refresh();
          }}
        >
          <Check /> Mark final
        </Button>
        <Button
          size="sm"
          onClick={async () => {
            const res = await saveLetterAction({ id: letter.id, content, status: "SENT" });
            if (res.ok) {
              toast.success("Marked sent — link it to an application to keep the trail.");
              router.refresh();
            }
          }}
        >
          <Send /> Mark sent
        </Button>
      </div>
      {/\[[A-Z ]{3,}\]/.test(content) ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Unreplaced [PLACEHOLDERS] remain — the scaffold only assembles what your resume can back
          up. Fill them in with your own specifics.
        </p>
      ) : null}
    </div>
  );
}
