import { cn } from "@/lib/utils";

type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNSPECIFIED" | string;
type IssueType = "NO_EPS" | "STALE" | "STATUS_ERROR" | string;

const priorityConfig: Record<string, { label: string; className: string }> = {
  CRITICAL: { label: "Crítico", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  HIGH: { label: "Alto", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  MEDIUM: { label: "Médio", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  LOW: { label: "Baixo", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  UNSPECIFIED: { label: "N/D", className: "bg-muted text-muted-foreground border-border" },
};

const issueConfig: Record<string, { label: string; className: string }> = {
  NO_EPS: { label: "Sem EPS", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  STALE: { label: "Inativo", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  STATUS_ERROR: { label: "Erro", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const config = priorityConfig[priority] ?? priorityConfig.UNSPECIFIED;
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
      config.className
    )}>
      {config.label}
    </span>
  );
}

export function IssueTypeBadge({ type }: { type: IssueType }) {
  const config = issueConfig[type] ?? { label: type, className: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
      config.className
    )}>
      {config.label}
    </span>
  );
}

export function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={cn(
      "inline-block w-2 h-2 rounded-full",
      active ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" : "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]"
    )} />
  );
}
