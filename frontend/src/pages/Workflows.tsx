import { useState, useCallback } from "react";
import { GitBranch, ChevronDown, ChevronRight, AlertCircle, Building2 } from "lucide-react";
import { skipToken } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { PageHeader, PageShell, EmptyState, ErrorState } from "@/components/r7/PageHeader";
import { TimeRangeSelector, TimeRangeMinutes, timeRangeLabel } from "@/components/r7/TimeRangeSelector";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCustomer } from "@/contexts/CustomerContext";
import { Link } from "wouter";

function formatDuration(start?: string, end?: string): string {
  if (!start) return "—";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const ms = e - s;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

type Job = {
  id?: string | null;
  jobId?: string | null;
  workflowId?: string | null;
  workflowName?: string | null;
  workflowState?: string | null;
  status?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  error?: string | null;
  stepErrors?: Array<{ step: string; message: string }>;
};

function JobRow({ job }: { job: Job }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = !!job.error || (job.stepErrors?.length ?? 0) > 0;

  return (
    <>
      <tr
        className={cn(
          "border-b border-border/50 hover:bg-accent/30 transition-colors",
          hasDetails && "cursor-pointer"
        )}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {hasDetails ? (
              expanded
                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            ) : <span className="w-3.5" />}
            <div>
              <p className="text-sm font-medium text-foreground">{job.workflowName ?? "—"}</p>
              <p className="text-xs text-muted-foreground font-mono">{(job.workflowId ?? job.jobId ?? "").slice(0, 16)}…</p>
            </div>
          </div>
        </td>
        <td className="py-3 px-4">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30">
            <AlertCircle className="w-3 h-3" />
            Falhado
          </span>
        </td>
        <td className="py-3 px-4 text-sm text-muted-foreground tabular-nums">{formatDate(job.startedAt ?? undefined)}</td>
        <td className="py-3 px-4 text-sm text-muted-foreground tabular-nums">{formatDuration(job.startedAt ?? undefined, job.completedAt ?? undefined)}</td>
        <td className="py-3 px-4 text-sm text-muted-foreground max-w-xs truncate">{job.error ?? "—"}</td>
      </tr>
      {expanded && hasDetails && (
        <tr className="border-b border-border/50 bg-accent/10">
          <td colSpan={5} className="px-4 py-3">
            {job.error && (
              <div className="mb-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Erro:</p>
                <p className="text-xs text-red-400 font-mono bg-red-500/5 border border-red-500/20 rounded p-2">{job.error}</p>
              </div>
            )}
            {(job.stepErrors?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Step Errors:</p>
                <div className="space-y-1">
                  {job.stepErrors!.map((se, i) => (
                    <div key={i} className="text-xs font-mono bg-orange-500/5 border border-orange-500/20 rounded p-2">
                      <span className="text-orange-400 font-medium">{se.step}:</span>{" "}
                      <span className="text-muted-foreground">{se.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function Workflows() {
  const [minutesAgo, setMinutesAgo] = useState<TimeRangeMinutes>(1440);
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();
  const { selectedCustomerId, selectedCustomer, customers, isLoading: customersLoading } = useCustomer();

  const queryInput = selectedCustomerId !== null
    ? { customerId: selectedCustomerId, minutesAgo, limit: 100 }
    : skipToken;

  const { data, isLoading, isError, error } = trpc.workflows.failedJobs.useQuery(queryInput, { retry: 0 });

  const handleRefresh = useCallback(() => {
    if (selectedCustomerId === null) return;
    utils.workflows.failedJobs.invalidate({ customerId: selectedCustomerId, minutesAgo, limit: 100 });
  }, [utils, selectedCustomerId, minutesAgo]);

  if (!customersLoading && customers.length === 0) {
    return (
      <PageShell>
        <PageHeader title="Workflows Falhados" description="Jobs do InsightConnect com status de falha" />
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-foreground font-medium mb-1">Nenhum customer configurado</p>
          <p className="text-sm text-muted-foreground mb-4">Adicione um customer para começar a monitorizar.</p>
          <Link href="/customers">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer">
              Gerir Customers
            </span>
          </Link>
        </div>
      </PageShell>
    );
  }

  const jobs = ((data?.jobs ?? []) as Job[]).filter(j => j != null);
  const filtered = jobs.filter((j) =>
    !search || (j.workflowName ?? "").toLowerCase().includes(search.toLowerCase()) || (j.jobId ?? j.workflowId ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const byWorkflow = (data?.byWorkflow ?? []) as Array<{ workflowId: string; name: string; count: number }>;
  const rangeLabel = timeRangeLabel(minutesAgo);

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          title="Workflows Falhados"
          description={selectedCustomer ? `${selectedCustomer.name} — Jobs do InsightConnect com falha` : "Jobs do InsightConnect com status de falha"}
          onRefresh={handleRefresh}
          refreshing={isLoading}
          noMargin
        />
        <TimeRangeSelector value={minutesAgo} onChange={setMinutesAgo} />
      </div>

      {byWorkflow.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {byWorkflow.slice(0, 5).map((wf) => (
            <div key={wf.workflowId} className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <p className="text-xs text-muted-foreground truncate mb-1" title={wf.name}>{wf.name}</p>
              <p className="text-2xl font-bold text-red-400 tabular-nums">{wf.count}</p>
              <p className="text-xs text-muted-foreground">falhas</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Pesquisar por workflow..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 bg-card border-border"
        />
        {data && (
          <span className="flex items-center text-xs text-muted-foreground">
            {filtered.length} de {jobs.length} jobs falhados nos últimos {rangeLabel}
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isError ? (
          <ErrorState message={error?.message} onRetry={handleRefresh} />
        ) : isLoading ? (
          <div className="p-8 flex justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nenhum workflow falhado"
            description={`Nenhuma falha registada nos últimos ${rangeLabel}.`}
            icon={GitBranch}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Workflow</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Iniciado</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Duração</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Erro</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((job, idx) => <JobRow key={job.jobId ?? job.id ?? idx} job={job} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
