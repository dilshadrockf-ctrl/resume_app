"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Badge, Card, Spinner } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { switchTemplateAction } from "@/features/resume/actions";
import { TemplateThumb } from "@/features/resume/template-thumb";
import type { ResumeDocument } from "@/lib/resume/document";

export function TemplateGalleryCard({
  template,
  doc,
  resumeId,
  current,
}: {
  template: { id: string; name: string; description: string; ats: string; tags: string[] };
  doc: ResumeDocument | null;
  resumeId: string | null;
  current: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Card className="overflow-hidden">
      <div className="relative flex h-[340px] justify-center overflow-hidden bg-muted/40 pt-4">
        <div className="pointer-events-none overflow-hidden rounded-t border shadow-md">
          <TemplateThumb doc={doc} templateId={template.id} width={230} />
        </div>
        {current ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            <Check className="size-3" /> in use
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{template.name}</h3>
          <Badge
            variant={
              template.ats === "excellent"
                ? "success"
                : template.ats === "good"
                  ? "secondary"
                  : "warning"
            }
          >
            ATS {template.ats}
          </Badge>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{template.description}</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {template.tags.map((t) => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
        </div>
        {!resumeId ? (
          <Button
            size="sm"
            className="mt-3 w-full"
            onClick={() => router.push(`/resumes?new=1&template=${template.id}`)}
          >
            Create resume with this template
          </Button>
        ) : !current ? (
          <Button
            size="sm"
            className="mt-3 w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await switchTemplateAction({ resumeId, templateId: template.id });
              setBusy(false);
              if (res.ok) {
                toast.success(`Switched to ${template.name} — content untouched.`);
                router.push(`/resumes/${resumeId}`);
              } else toast.error(res.error);
            }}
          >
            {busy ? <Spinner /> : null} Use for my resume
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="mt-3 w-full"
            onClick={() => router.push(`/resumes/${resumeId!}`)}
          >
            Open editor
          </Button>
        )}
      </div>
    </Card>
  );
}
