import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  variant?: "default" | "danger" | "warning" | "success" | "info";
  loading?: boolean;
}

const variantStyles = {
  default: "border-border",
  danger: "border-red-500/30 bg-red-500/5",
  warning: "border-yellow-500/30 bg-yellow-500/5",
  success: "border-green-500/30 bg-green-500/5",
  info: "border-blue-500/30 bg-blue-500/5",
};

const iconStyles = {
  default: "bg-muted text-muted-foreground",
  danger: "bg-red-500/15 text-red-400",
  warning: "bg-yellow-500/15 text-yellow-400",
  success: "bg-green-500/15 text-green-400",
  info: "bg-blue-500/15 text-blue-400",
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  loading = false,
}: MetricCardProps) {
  return (
    <div className={cn(
      "rounded-lg border bg-card p-5 flex flex-col gap-3",
      variantStyles[variant]
    )}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">{title}</p>
        </div>
        <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ml-2", iconStyles[variant])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-8 w-20 bg-muted animate-pulse rounded" />
          <div className="h-3 w-32 bg-muted animate-pulse rounded" />
        </div>
      ) : (
        <>
          <div className="text-3xl font-bold text-foreground tabular-nums">{value}</div>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <div className={cn(
              "text-xs font-medium",
              trend.value > 0 ? "text-red-400" : trend.value < 0 ? "text-green-400" : "text-muted-foreground"
            )}>
              {trend.value > 0 ? "↑" : trend.value < 0 ? "↓" : "—"} {Math.abs(trend.value)} {trend.label}
            </div>
          )}
        </>
      )}
    </div>
  );
}
