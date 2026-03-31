import { useState, useCallback, useMemo } from "react";
import { Monitor, Building2 } from "lucide-react";
import { skipToken } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { PageHeader, PageShell, EmptyState, ErrorState } from "@/components/r7/PageHeader";
import { Input } from "@/components/ui/input";
import { useCustomer } from "@/contexts/CustomerContext";
import { Link } from "wouter";

export default function Assets() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const utils = trpc.useUtils();
  const { selectedCustomerId, selectedCustomer, customers, isLoading: customersLoading } = useCustomer();

  const PAGE_SIZE = 100;

  const statsInput = selectedCustomerId !== null ? { customerId: selectedCustomerId } : skipToken;
  const listInput = useMemo(() => {
    if (selectedCustomerId === null) return skipToken;
    return { customerId: selectedCustomerId, query: search, size: PAGE_SIZE, page };
  }, [selectedCustomerId, search, page]);

  const statsQuery = trpc.assets.stats.useQuery(statsInput, { retry: 0 });
  const { data, isLoading, isError, error } = trpc.assets.list.useQuery(listInput, { retry: 0 });

  const handleRefresh = useCallback(() => {
    if (selectedCustomerId === null) return;
    utils.assets.list.invalidate({ customerId: selectedCustomerId });
    utils.assets.stats.invalidate({ customerId: selectedCustomerId });
  }, [utils, selectedCustomerId]);

  if (!customersLoading && customers.length === 0) {
    return (
      <PageShell>
        <PageHeader title="Assets" description="Endpoints monitorizados pelo Rapid7 InsightIDR" />
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
        <PageHeader title="Assets" description="Endpoints monitorizados pelo Rapid7 InsightIDR" onRefresh={handleRefresh} refreshing={false} />
        <ErrorState message={`Erro ao comunicar com a API Rapid7: ${(error as unknown as Error | null)?.message ?? "Erro desconhecido"}. Verifique a API Key nas Definições.`} />
      </PageShell>
    );
  }

  const assets = data?.assets ?? [];
  const total = statsQuery.data?.total ?? data?.total ?? 0;

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          title="Assets"
          description={selectedCustomer
            ? `${selectedCustomer.name} — Endpoints monitorizados pelo InsightIDR`
            : "Endpoints monitorizados pelo Rapid7 InsightIDR"}
          onRefresh={handleRefresh}
          refreshing={isLoading || statsQuery.isLoading}
          noMargin
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
          <p className="text-xs text-muted-foreground">Total de Assets</p>
          <p className="text-2xl font-bold text-blue-400 tabular-nums">
            {statsQuery.isLoading ? "—" : total.toLocaleString("pt-PT")}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Nesta página</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {isLoading ? "—" : assets.length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Página</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{page + 1}</p>
        </div>
      </div>

      {/* Pesquisa */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Pesquisar por nome..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="w-72 bg-card border-border"
        />
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 rounded-md bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={Monitor}
          title="Nenhum asset encontrado"
          description={search ? "Tente alterar o termo de pesquisa." : "Nenhum asset disponível para este customer."}
        />
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nome</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">RRN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(assets as Array<{ rrn?: string; name?: string }>).map((asset, idx) => (
                  <tr key={asset.rrn ?? idx} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {asset.name ?? <span className="text-muted-foreground italic">Sem nome</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs hidden md:table-cell truncate max-w-xs">
                      {asset.rrn ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">
              A mostrar {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total.toLocaleString("pt-PT")} assets
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-xs rounded-md border border-border bg-card hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= total}
                className="px-3 py-1.5 text-xs rounded-md border border-border bg-card hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Seguinte
              </button>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
