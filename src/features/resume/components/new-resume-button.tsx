"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";
import { Field, Input, Spinner } from "@/components/ui/primitives";
import { createResumeAction } from "@/features/resume/actions";
import { toast } from "@/components/ui/toast";

function NewResumeButtonInner({
  label = "New resume",
  variant = "default",
  size = "default",
}: {
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const templateId = params.get("template") ?? undefined;

  // `/resumes?new=1` (sidebar shortcut, templates gallery) opens the dialog directly.
  React.useEffect(() => {
    if (params.get("new") === "1") {
      setName(defaultName());
      setOpen(true);
    }
  }, [params]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await createResumeAction({ name: name.trim(), templateId });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.push(`/resumes/${res.data.resumeId}`);
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => {
          setName(defaultName());
          setOpen(true);
        }}
      >
        <Plus className="size-4" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New resume</DialogTitle>
            <DialogDescription>
              Starts from your career profile — every existing role, project and skill is attached,
              ready to hide or reorder.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <Field
              label="Resume name"
              htmlFor="resume-name"
              hint="For your own organization — it is not printed on the document."
            >
              <Input
                id="resume-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                autoFocus
              />
            </Field>
            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? <Spinner /> : null} Create & open
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function defaultName() {
  const now = new Date();
  return `Resume — ${now.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`;
}

export function NewResumeButton(props: {
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  return (
    <React.Suspense
      fallback={
        <Button variant={props.variant} size={props.size} disabled>
          <Plus className="size-4" /> {props.label ?? "New resume"}
        </Button>
      }
    >
      <NewResumeButtonInner {...props} />
    </React.Suspense>
  );
}
