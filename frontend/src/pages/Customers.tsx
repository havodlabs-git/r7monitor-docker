import { useState } from "react";
import { Plus, Pencil, Trash2, Wifi, WifiOff, Eye, EyeOff, Loader2, Building2, CheckCircle, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader, PageShell } from "@/components/r7/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useCustomer } from "@/contexts/CustomerContext";

const REGIONS = [
  { value: "us", label: "United States (us)" },
  { value: "eu", label: "Europe (eu)" },
  { value: "ca", label: "Canada (ca)" },
  { value: "au", label: "Australia (au)" },
  { value: "ap", label: "Asia Pacific (ap)" },
];

type CustomerForm = {
  name: string;
  apiKey: string;
  region: string;
  incPattern: string;
};

const DEFAULT_FORM: CustomerForm = { name: "", apiKey: "", region: "us", incPattern: "INC" };

export default function Customers() {
  const { customers, refetch } = useCustomer();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerForm>(DEFAULT_FORM);
  const [showKey, setShowKey] = useState(false);
  const [testResults, setTestResults] = useState<Record<number, { success: boolean; message: string } | null>>({});

  const utils = trpc.useUtils();

  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      toast.success("Customer criado com sucesso");
      setShowModal(false);
      setForm(DEFAULT_FORM);
      utils.customers.list.invalidate();
      refetch();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      toast.success("Customer atualizado com sucesso");
      setShowModal(false);
      setEditingId(null);
      setForm(DEFAULT_FORM);
      utils.customers.list.invalidate();
      refetch();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = trpc.customers.delete.useMutation({
    onSuccess: () => {
      toast.success("Customer removido");
      setDeleteId(null);
      utils.customers.list.invalidate();
      refetch();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const testMutation = trpc.customers.testConnection.useMutation({
    onSuccess: (data, variables) => {
      setTestResults((prev) => ({ ...prev, [variables.id]: data }));
      if (data.success) toast.success(data.message);
      else toast.error(data.message);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setShowKey(false);
    setShowModal(true);
  };

  const openEdit = (c: typeof customers[0]) => {
    setEditingId(c.id);
    setForm({ name: c.name, apiKey: "", region: c.region, incPattern: c.incPattern });
    setShowKey(false);
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    if (!editingId && !form.apiKey.trim()) { toast.error("API Key obrigatória"); return; }
    if (editingId) {
      const data: Parameters<typeof updateMutation.mutate>[0] = { id: editingId, name: form.name, region: form.region as "us"|"eu"|"ca"|"au"|"ap", incPattern: form.incPattern };
      if (form.apiKey.trim()) data.apiKey = form.apiKey;
      updateMutation.mutate(data);
    } else {
      createMutation.mutate({ name: form.name, apiKey: form.apiKey, region: form.region as "us"|"eu"|"ca"|"au"|"ap", incPattern: form.incPattern });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <PageShell>
      <PageHeader
        title="Customers"
        description="Gerir os tenants Rapid7 monitorizados"
      />

      <div className="flex justify-end mb-4">
        <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
          <Plus className="w-4 h-4" />
          Novo Customer
        </Button>
      </div>

      {customers.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-foreground font-medium mb-1">Nenhum customer configurado</p>
          <p className="text-sm text-muted-foreground mb-4">Adicione o primeiro customer para começar a monitorizar</p>
          <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
            <Plus className="w-4 h-4" />
            Adicionar Customer
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Região</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Padrão INC</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">API Key</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Conexão</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const testResult = testResults[c.id];
                return (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
                          <Building2 className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="font-medium text-foreground">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30 uppercase">
                        {c.region}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-muted-foreground">{c.incPattern}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-muted-foreground">{c.apiKeyPreview}</span>
                    </td>
                    <td className="py-3 px-4">
                      {testResult ? (
                        <div className="flex items-center gap-1.5">
                          {testResult.success
                            ? <CheckCircle className="w-4 h-4 text-green-400" />
                            : <XCircle className="w-4 h-4 text-red-400" />}
                          <span className={`text-xs ${testResult.success ? "text-green-400" : "text-red-400"}`}>
                            {testResult.success ? "OK" : "Falhou"}
                          </span>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                          onClick={() => testMutation.mutate({ id: c.id })}
                          disabled={testMutation.isPending}
                        >
                          {testMutation.isPending && testMutation.variables?.id === c.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Wifi className="w-3 h-3" />}
                          Testar
                        </Button>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => openEdit(c)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal criar/editar */}
      <Dialog open={showModal} onOpenChange={(o) => { if (!o) { setShowModal(false); setEditingId(null); } }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingId ? "Editar Customer" : "Novo Customer"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Nome do Customer *</Label>
              <Input
                placeholder="Ex: Empresa XPTO"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">
                API Key do Rapid7 {editingId ? "(deixe vazio para manter)" : "*"}
              </Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  placeholder={editingId ? "••••••••  (manter atual)" : "Cole a API Key aqui"}
                  value={form.apiKey}
                  onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  className="bg-input border-border pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm text-foreground">Região</Label>
                <Select value={form.region} onValueChange={(v) => setForm((f) => ({ ...f, region: v }))}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {REGIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm text-foreground">Padrão INC</Label>
                <Input
                  placeholder="INC"
                  value={form.incPattern}
                  onChange={(e) => setForm((f) => ({ ...f, incPattern: e.target.value.toUpperCase() }))}
                  className="bg-input border-border font-mono"
                  maxLength={16}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} className="border-border bg-card hover:bg-accent">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />A guardar…</> : editingId ? "Atualizar" : "Criar Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminação */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Remover Customer?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta ação é irreversível. O customer e a sua API Key serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border bg-card hover:bg-accent text-foreground">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
