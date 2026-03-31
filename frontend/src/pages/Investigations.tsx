import { useState, useCallback } from "react";
import { Search, MessageSquare, Building2, AlertTriangle, ExternalLink, Loader2, Plus } from "lucide-react";
import { skipToken } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { PageHeader, PageShell, EmptyState, ErrorState } from "@/components/r7/PageHeader";
import { PriorityBadge } from "@/components/r7/StatusBadge";
import { TimeRangeSelector, TimeRangeMinutes, timeRangeLabel } from "@/components/r7/TimeRangeSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCustomer } from "@/contexts/CustomerContext";
import { Link } from "wouter";
import { toast } from "sonner";

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

interface Investigation {
  id?: string;
  rrn?: string;
  title?: string;
  priority: string;
  status: string;
  created_time?: string;
  commentsCount: number;
}

export default function Investigations() {
  const [minutesAgo, setMinutesAgo] = useState<TimeRangeMinutes>(1440);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("ALL");
  const utils = trpc.useUtils();
  const { selectedCustomerId, selectedCustomer, customers, isLoading: customersLoading } = useCustomer();

  // Modal para abrir incidente
  const [incModal, setIncModal] = useState<Investigation | null>(null);
  const [incResult, setIncResult] = useState<{ number?: string; incidentUrl?: string } | null>(null);

  const queryInput = selectedCustomerId !== null
    ? { customerId: selectedCustomerId, minutesAgo, size: 100 }
    : skipToken;

  const { data, isLoading, isError, error } = trpc.investigations.withoutInc.useQuery(queryInput, { retry: 0 });

  const createIncidentMutation = trpc.incidents.create.useMutation({
    onSuccess: (result) => {
      setIncResult({ number: result.number, incidentUrl: result.incidentUrl });
      toast.success(`Incidente ${result.number} criado com sucesso!`);
      // Invalidar para que a investigation desapareça da lista (agora tem INC)
      if (selectedCustomerId !== null) {
        utils.investigations.withoutInc.invalidate({ customerId: selectedCustomerId, minutesAgo, size: 100 });
      }
    },
    onError: (err) => {
      toast.error(`Erro ao criar incidente: ${err.message}`);
    },
  });

  const handleRefresh = useCallback(() => {
    if (selectedCustomerId === null) return;
    utils.investigations.withoutInc.invalidate({ customerId: selectedCustomerId, minutesAgo, size: 100 });
  }, [utils, selectedCustomerId, minutesAgo]);

  const openIncidentModal = (inv: Investigation) => {
    setIncResult(null);
    setIncModal(inv);
  };

  const handleCreateIncident = () => {
    if (!incModal || selectedCustomerId === null) return;
    createIncidentMutation.mutate({
      customerId: selectedCustomerId,
      investigationRrn: incModal.rrn ?? incModal.id ?? "",
      investigationTitle: incModal.title ?? "Investigation sem título",
      investigationPriority: incModal.priority,
      investigationCreatedTime: incModal.created_time ?? "",
    });
  };

  const closeIncidentModal = () => {
    setIncModal(null);
    setIncResult(null);
  };

  if (!customersLoading && customers.length === 0) {
    return (
      <PageShell>
        <PageHeader title="Investigations Sem INC" description="Investigations abertas sem referência a incidente do ServiceNow nos comentários" />
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
        <PageHeader title="Investigations Sem INC" description="Investigations abertas sem referência a incidente" onRefresh={handleRefresh} refreshing={false} />
        <ErrorState message={`Erro ao comunicar com a API Rapid7: ${(error as unknown as Error | null)?.message ?? "Erro desconhecido"}. Verifique a API Key nas Definições.`} />
      </PageShell>
    );
  }

  const investigations = data?.investigations ?? [];
  const filtered = investigations.filter((inv) => {
    const matchSearch = !search ||
      (inv.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (inv.id ?? "").toLowerCase().includes(search.toLowerCase());
    const matchPriority = priority === "ALL" || inv.priority === priority;
    return matchSearch && matchPriority;
  });

  const rangeLabel = timeRangeLabel(minutesAgo);

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          title="Investigations Sem INC"
          description={selectedCustomer
            ? `${selectedCustomer.name} — Investigations sem referência a incidente`
            : "Investigations abertas sem referência a incidente do ServiceNow nos comentários"}
          onRefresh={handleRefresh}
          refreshing={isLoading}
          noMargin
        />
        <TimeRangeSelector value={minutesAgo} onChange={setMinutesAgo} />
      </div>

      {data && (
        <div className="flex gap-4 mb-6">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Verificadas</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">{data.totalChecked}</p>
          </div>
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-xs text-muted-foreground">Sem INC</p>
            <p className="text-2xl font-bold text-red-400 tabular-nums">{data.total}</p>
          </div>
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
            <p className="text-xs text-muted-foreground">Com INC</p>
            <p className="text-2xl font-bold text-green-400 tabular-nums">{data.totalChecked - data.total}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Pesquisar por título ou ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72 bg-card border-border"
        />
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-44 bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="ALL">Todas as prioridades</SelectItem>
            <SelectItem value="CRITICAL">Crítico</SelectItem>
            <SelectItem value="HIGH">Alto</SelectItem>
            <SelectItem value="MEDIUM">Médio</SelectItem>
            <SelectItem value="LOW">Baixo</SelectItem>
          </SelectContent>
        </Select>
        {data && (
          <span className="flex items-center text-xs text-muted-foreground">
            {filtered.length} de {investigations.length} investigations nos últimos {rangeLabel}
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
            title="Nenhuma investigation sem INC"
            description={search || priority !== "ALL"
              ? "Nenhum resultado para os filtros aplicados."
              : `Todas as investigations têm referência a INC nos últimos ${rangeLabel}.`}
            icon={Search}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Título</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Prioridade</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Criado</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Comentários</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id ?? inv.rrn} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-foreground max-w-xs truncate" title={inv.title}>{inv.title}</p>
                      <p className="text-xs text-muted-foreground font-mono">{(inv.id ?? inv.rrn ?? "").slice(0, 20)}…</p>
                    </td>
                    <td className="py-3 px-4"><PriorityBadge priority={inv.priority} /></td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground tabular-nums whitespace-nowrap">{formatDate(inv.created_time)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="text-xs tabular-nums">{inv.commentsCount}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 gap-1"
                          onClick={() => openIncidentModal(inv as Investigation)}
                          title="Abrir incidente no ServiceNow"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Abrir INC
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de confirmação para abrir incidente */}
      <Dialog open={incModal !== null} onOpenChange={(o) => { if (!o) closeIncidentModal(); }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              {incResult ? (
                <>Incidente Criado</>
              ) : (
                <><AlertTriangle className="w-5 h-5 text-orange-400" /> Abrir Incidente no ServiceNow</>
              )}
            </DialogTitle>
          </DialogHeader>

          {incResult ? (
            <div className="py-4 space-y-4">
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-center">
                <p className="text-green-400 font-bold text-xl mb-1">{incResult.number}</p>
                <p className="text-sm text-muted-foreground">Incidente criado com sucesso</p>
              </div>
              <p className="text-sm text-muted-foreground">
                O número <strong className="text-foreground">{incResult.number}</strong> foi adicionado como comentário na investigation do InsightIDR.
              </p>
              {incResult.incidentUrl && (
                <a
                  href={incResult.incidentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir no ServiceNow
                </a>
              )}
              <DialogFooter>
                <Button onClick={closeIncidentModal} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="py-2 space-y-3">
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Título:</span>
                    <span className="text-foreground font-medium text-right max-w-[280px] truncate">{incModal?.title}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prioridade:</span>
                    <PriorityBadge priority={incModal?.priority ?? "MEDIUM"} />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Criado:</span>
                    <span className="text-foreground tabular-nums">{formatDate(incModal?.created_time)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="text-foreground">{selectedCustomer?.name ?? "—"}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
                  <p className="text-xs text-orange-300">
                    Será criado um incidente no ServiceNow com os dados acima. O número do INC será adicionado automaticamente como comentário na investigation do InsightIDR.
                  </p>
                </div>

                {!selectedCustomer?.snowCallerId && (
                  <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                    <p className="text-xs text-yellow-300">
                      Aviso: Caller ID não configurado para este customer. O incidente será criado sem caller. Configure o Caller ID nas definições do customer.
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeIncidentModal} className="border-border bg-card hover:bg-accent">
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateIncident}
                  disabled={createIncidentMutation.isPending}
                  className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
                >
                  {createIncidentMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> A criar…</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Criar Incidente</>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
