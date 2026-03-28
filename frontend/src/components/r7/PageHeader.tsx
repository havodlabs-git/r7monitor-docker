import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  children?: React.ReactNode;
  /** Quando true, remove o mb-6 do wrapper (útil quando o pai já controla o espaçamento) */
  noMargin?: boolean;
  /** Alias de noMargin para compatibilidade */
  inline?: boolean;
}

export function PageHeader({ title, description, onRefresh, refreshing, children, noMargin, inline }: PageHeaderProps) {
  const noMb = noMargin || inline;
  return (
    <div className={`flex items-start justify-between gap-4 ${noMb ? "" : "mb-6"}`}>
      <div>
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {children}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="gap-2 border-border bg-card hover:bg-accent"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            Atualizar
          </Button>
        )}
      </div>
    </div>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 min-h-full">
      {children}
    </div>
  );
}

export function EmptyState({ title, description, icon: Icon }: {
  title: string;
  description?: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted mb-4">
          <Icon className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 mb-4">
        <span className="text-2xl">⚠</span>
      </div>
      <p className="text-sm font-medium text-foreground">Erro ao carregar dados</p>
      {message && <p className="text-xs text-muted-foreground mt-1 max-w-sm">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
