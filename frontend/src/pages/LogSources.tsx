import { useState, useCallback } from "react";
import { Database, Building2 } from "lucide-react";
import { skipToken } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { PageHeader, PageShell, EmptyState, ErrorState } from "@/components/r7/PageHeader";
import { IssueTypeBadge } from "@/components/r7/StatusBadge";
import { TimeRangeSelector, TimeRangeMinutes } from "@/components/r7/TimeRangeSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useCustomer } from "@/contexts/CustomerContext";
import { Link } from "wouter";

export default function LogSources() {
  const [minutesAgo, setMinutesAgo] = useState<TimeRangeMinutes>(1440);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();
  const { selectedCustomerId, selectedCustomer, customers, isLoading: customersLoading } = useCustomer();

  const queryInput = selectedCustomerId !== null
    ? { customerId: selectedCustomerId, minutesAgo }
    : skipToken;

  const { data, isLoading, isError, error } = trpc.logSources.issues.useQuery(queryInput, { retry: 0 });
  const statsQuery = trpc.logSources.stats.useQuery(queryInput, { retry: 0 });

  const handleRefresh = useCallback(() => {
    if (selectedCustomerId === null) return;
    utils.logSources.issues.invalidate({ customerId: selectedCustomerId, minutesAgo });
    utils.logSources.stats.invalidate({ customerId: selectedCustomerId, minutesAgo });
  }, [utils, selectedCustomerId, minutesAgo]);

  if (!customersLoading && customers.length === 0) {
    return (
      <PageShell>
        <PageHeader title="Log Sources com Problemas" description="Log sources sem EPS, inativos ou com erros de status" />
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

  if (isError) {
    return (
      <PageShell>
        <PageHeader title="Log Sources com Problemas" description="Log sources sem EPS, inativos ou com erros de status" onRefresh={handleRefresh} refreshing={false} />
        <ErrorState message={`Erro ao comunicar com a API Rapid7: ${(error as unknown as Error | null)?.message ?? "Erro desconhecido"}. Verifique a API Key nas Definições.`} />
      </PageShell>
    );
  }

  const issues = (data?.issues ?? []) as Array<{
    id?: string | null;
    name?: string | null;
    sourceType?: string | null;
    logsets?: string | null;
    tokensCount?: number | null;
    issueType?: string | null;
    issueReason?: string | null;
  }>;

  const filtered = issues.filter((ls) => {
    const matchSearch = !search || (ls.name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "ALL" || ls.issueType === filter;
    return matchSearch && matchFilter;
  });

  const stats = statsQuery.data;

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          title="Log Sources com Problemas"
          description={selectedCustomer
            ? `${selectedCustomer.name} — Log sources sem actividade nas últimas 24h ou 7 dias`
            : "Log sources sem actividade recente ou não configurados"}
          onRefresh={handleRefresh}
          refreshing={isLoading || statsQuery.isLoading}
          noMargin
        />
        <TimeRangeSelector value={minutesAgo} onChange={setMinutesAgo} />
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
            <p className="text-xs text-muted-foreground">Saudáveis</p>
            <p className="text-2xl font-bold text-green-400 tabular-nums">{stats.healthy}</p>
          </div>
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-xs text-muted-foreground">Sem EPS (24h)</p>
            <p className="text-2xl font-bold text-red-400 tabular-nums">{stats.noEps}</p>
          </div>
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-3">
            <p className="text-xs text-muted-foreground">Inativos (7d)</p>
            <p className="text-2xl font-bold text-orange-400 tabular-nums">{stats.stale ?? 0}</p>
          </div>
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
            <p className="text-xs text-muted-foreground">Não Configurados</p>
            <p className="text-2xl font-bold text-yellow-400 tabular-nums">{stats.stale}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Pesquisar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 bg-card border-border"
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44 bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="ALL">Todos os problemas</SelectItem>
            <SelectItem value="NO_EPS">Sem EPS (24h)</SelectItem>
            <SelectItem value="INACTIVE">Inativos (7d)</SelectItem>
            <SelectItem value="STALE">Não Configurados</SelectItem>
          </SelectContent>
        </Select>
        {data && (
          <span className="flex items-center text-xs text-muted-foreground">
            {filtered.length} de {issues.length} com problemas ({data.totalLogs} total)
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isError ? (
          <ErrorState message={(error as unknown as Error | null)?.message ?? "Erro desconhecido"} onRetry={handleRefresh} />
        ) : isLoading ? (
          <div className="p-8 flex justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nenhum log source com problema"
            description={search || filter !== "ALL"
              ? "Nenhum resultado para os filtros aplicados."
              : "Todos os log sources estão a funcionar corretamente."}
            icon={Database}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Logsets</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tokens</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Problema</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ls) => (
                  <tr key={ls.id ?? ls.name ?? Math.random().toString()} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-foreground max-w-xs truncate" title={ls.name ?? ""}>{ls.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground font-mono">{ls.id ? ls.id.slice(0, 16) + "…" : "—"}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{ls.sourceType ?? "—"}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground max-w-[160px] truncate" title={ls.logsets ?? ""}>{ls.logsets ?? "—"}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground tabular-nums">{ls.tokensCount ?? 0}</td>
                    <td className="py-3 px-4">{ls.issueType && <IssueTypeBadge type={ls.issueType} />}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground max-w-xs truncate" title={ls.issueReason ?? ""}>{ls.issueReason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
