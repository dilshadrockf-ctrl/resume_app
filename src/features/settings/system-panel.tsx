import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";

export interface SystemCheck {
  label: string;
  ok: boolean;
  warn?: boolean;
  detail: string;
}

export function SystemPanel({ checks }: { checks: SystemCheck[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">System status</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {checks.map((c) => (
          <div key={c.label} className="flex items-start gap-2 text-sm">
            {c.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            ) : c.warn ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            )}
            <span className="w-24 shrink-0 font-medium">{c.label}</span>
            <span className="min-w-0 flex-1 break-words text-xs text-muted-foreground">{c.detail}</span>
            <Badge variant={c.ok ? "success" : c.warn ? "warning" : "destructive"}>{c.ok ? "ok" : c.warn ? "optional" : "down"}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
