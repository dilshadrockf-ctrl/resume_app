"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
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

export function NewResumeButton({
  label = "New resume",
  variant = "default",
  size = "default",
}: {
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await createResumeAction({ name: name.trim() });
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
