import { useState, useCallback } from "react";
import { GitBranch, Search, Database, AlertTriangle, CheckCircle, Building2 } from "lucide-react";
import { skipToken } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { MetricCard } from "@/components/r7/MetricCard";
import { PageHeader, PageShell, ErrorState } from "@/components/r7/PageHeader";
import { PriorityBadge } from "@/components/r7/StatusBadge";
import { TimeRangeSelector, TimeRangeMinutes, timeRangeLabel } from "@/components/r7/TimeRangeSelector";
import { useCustomer } from "@/contexts/CustomerContext";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = {
  healthy: "#4ade80",
  noEps: "#f87171",
  stale: "#facc15",
  statusError: "#fb923c",
};

const PRIORITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNSPECIFIED"];

export default function Dashboard() {
  const [minutesAgo, setMinutesAgo] = useState<TimeRangeMinutes>(1440);
  const utils = trpc.useUtils();
  const { selectedCustomerId, selectedCustomer, customers, isLoading: customersLoading } = useCustomer();

  const queryInput = selectedCustomerId !== null
    ? { customerId: selectedCustomerId, minutesAgo }
    : skipToken;

  const wfStats = trpc.workflows.stats.useQuery(queryInput, { retry: 1 });
  const invStats = trpc.investigations.stats.useQuery(queryInput, { retry: 1 });
  const lsStats = trpc.logSources.stats.useQuery(queryInput, { retry: 1 });

  const isLoading = wfStats.isLoading || invStats.isLoading || lsStats.isLoading;

  const handleRefresh = useCallback(() => {
    if (selectedCustomerId === null) return;
    const input = { customerId: selectedCustomerId, minutesAgo };
    utils.workflows.stats.invalidate(input);
    utils.investigations.stats.invalidate(input);
    utils.logSources.stats.invalidate(input);
  }, [utils, selectedCustomerId, minutesAgo]);

  // Estado: sem customers configurados
  if (!customersLoading && customers.length === 0) {
    return (
      <PageShell>
        <PageHeader title="Dashboard" description="Visão geral do Rapid7 InsightIDR" />
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-foreground font-medium mb-1">Nenhum customer configurado</p>
          <p className="text-sm text-muted-foreground mb-4">
            Adicione um customer com a sua API Key do Rapid7 para começar a monitorizar.
          </p>
          <Link href="/customers">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer">
              <Building2 className="w-4 h-4" />
              Gerir Customers
            </span>
          </Link>
        </div>
      </PageShell>
    );
  }

  // Estado: sem customer selecionado
  if (!customersLoading && selectedCustomerId === null) {
    return (
      <PageShell>
        <PageHeader title="Dashboard" description="Visão geral do Rapid7 InsightIDR" />
        <ErrorState message="Selecione um customer na sidebar para ver os dados." />
      </PageShell>
    );
  }

  const workflowChartData = (wfStats.data?.topWorkflows ?? []).map((wf) => ({
    name: wf.name.length > 20 ? wf.name.slice(0, 18) + "…" : wf.name,
    falhas: wf.count,
  }));

  const lsData = lsStats.data;
  const pieData = lsData ? [
    { name: "Saudáveis", value: lsData.healthy, color: COLORS.healthy },
    { name: "Sem EPS", value: lsData.noEps, color: COLORS.noEps },
    { name: "Inativos", value: lsData.stale, color: COLORS.stale },
    { name: "Com Erro", value: lsData.statusError, color: COLORS.statusError },
  ].filter((d) => d.value > 0) : [];

  const byPriority = (invStats.data?.byPriority ?? []) as Array<{ priority: string; total: number; withInc: number; withoutInc: number }>;
  const priorityRows = PRIORITY_ORDER
    .map((p) => byPriority.find((r) => r.priority === p))
    .filter(Boolean) as typeof byPriority;

  const rangeLabel = timeRangeLabel(minutesAgo);

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          title="Dashboard"
          description={selectedCustomer ? `${selectedCustomer.name} — Rapid7 InsightIDR` : "Visão geral do Rapid7 InsightIDR"}
          onRefresh={handleRefresh}
          refreshing={isLoading}
          inline
        />
        <TimeRangeSelector value={minutesAgo} onChange={setMinutesAgo} />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title={`Workflows Falhados (${rangeLabel})`}
          value={wfStats.data?.failedInRange ?? "—"}
          subtitle={`${wfStats.data?.failed7d ?? "—"} nos últimos 7 dias`}
          icon={GitBranch}
          variant={(wfStats.data?.failedInRange ?? 0) > 0 ? "danger" : "success"}
          loading={wfStats.isLoading}
        />
        <MetricCard
          title="Investigations Sem INC"
          value={invStats.data?.withoutInc ?? "—"}
          subtitle={`${invStats.data?.total ?? "—"} investigations abertas`}
          icon={Search}
          variant={(invStats.data?.withoutInc ?? 0) > 0 ? "warning" : "success"}
          loading={invStats.isLoading}
        />
        <MetricCard
          title="Log Sources c/ Problema"
          value={lsData ? (lsData.noEps + lsData.stale + lsData.statusError) : "—"}
          subtitle={`${lsData?.total ?? "—"} log sources no total`}
          icon={Database}
          variant={(lsData && (lsData.noEps + lsData.stale + lsData.statusError) > 0) ? "danger" : "success"}
          loading={lsStats.isLoading}
        />
        <MetricCard
          title="Taxa de Problemas"
          value={lsData ? `${lsData.issueRate}%` : "—"}
          subtitle="Log sources com algum problema"
          icon={lsData && lsData.issueRate > 10 ? AlertTriangle : CheckCircle}
          variant={lsData && lsData.issueRate > 20 ? "danger" : lsData && lsData.issueRate > 5 ? "warning" : "success"}
          loading={lsStats.isLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Top Workflows com Falhas (7 dias)</h3>
          <p className="text-xs text-muted-foreground mb-4">Workflows com mais execuções falhadas</p>
          {wfStats.isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : workflowChartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
              Nenhuma falha nos últimos 7 dias
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={workflowChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.012 255)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "oklch(0.52 0.008 255)" }} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.008 255)" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.14 0.012 255)", border: "1px solid oklch(0.22 0.012 255)", borderRadius: "6px", fontSize: "12px" }}
                  labelStyle={{ color: "oklch(0.92 0.008 255)" }}
                  itemStyle={{ color: "oklch(0.54 0.22 25)" }}
                />
                <Bar dataKey="falhas" fill="oklch(0.54 0.22 25)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Distribuição de Log Sources</h3>
          <p className="text-xs text-muted-foreground mb-4">Estado atual de todos os log sources</p>
          {lsStats.isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
              Sem dados de log sources
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "oklch(0.14 0.012 255)", border: "1px solid oklch(0.22 0.012 255)", borderRadius: "6px", fontSize: "12px" }}
                  itemStyle={{ color: "oklch(0.92 0.008 255)" }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span style={{ fontSize: "11px", color: "oklch(0.82 0.008 255)" }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Priority Table */}
      {priorityRows.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Cobertura INC por Prioridade</h3>
          <p className="text-xs text-muted-foreground mb-4">Investigations abertas nos últimos {rangeLabel}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Prioridade</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Com INC</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Sem INC</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {priorityRows.map((row) => {
                  const coverage = row.total > 0 ? Math.round((row.withInc / row.total) * 100) : 0;
                  return (
                    <tr key={row.priority} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="py-2.5 px-3"><PriorityBadge priority={row.priority} /></td>
                      <td className="py-2.5 px-3 text-right text-foreground tabular-nums">{row.total}</td>
                      <td className="py-2.5 px-3 text-right text-green-400 tabular-nums">{row.withInc}</td>
                      <td className="py-2.5 px-3 text-right text-red-400 tabular-nums">{row.withoutInc}</td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-green-400 transition-all" style={{ width: `${coverage}%` }} />
                          </div>
                          <span className={coverage < 50 ? "text-red-400" : coverage < 80 ? "text-yellow-400" : "text-green-400"}>
                            {coverage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageShell>
  );
}
