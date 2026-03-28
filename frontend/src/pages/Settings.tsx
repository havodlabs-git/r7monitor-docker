import { useState, useEffect } from "react";
import { Eye, EyeOff, CheckCircle, XCircle, Loader2, Key, Globe, Tag } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader, PageShell } from "@/components/r7/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const REGIONS = [
  { value: "us", label: "United States (us)" },
  { value: "eu", label: "Europe (eu)" },
  { value: "ca", label: "Canada (ca)" },
  { value: "au", label: "Australia (au)" },
  { value: "ap", label: "Asia Pacific (ap)" },
];

export default function Settings() {
  const [apiKey, setApiKey] = useState("");
  const [region, setRegion] = useState("us");
  const [incPattern, setIncPattern] = useState("INC");
  const [showKey, setShowKey] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data: settings, isLoading } = trpc.settings.get.useQuery();
  const saveMutation = trpc.settings.save.useMutation({
    onSuccess: () => {
      toast.success("Configurações guardadas com sucesso");
      setDirty(false);
      setApiKey(""); // limpar campo após guardar
    },
    onError: (err) => {
      toast.error(`Erro ao guardar: ${err.message}`);
    },
  });

  const clearCacheMutation = trpc.settings.clearCache.useMutation({
    onSuccess: () => toast.success("Cache limpo com sucesso"),
    onError: () => toast.error("Erro ao limpar cache"),
  });

  useEffect(() => {
    if (settings) {
      setRegion(settings.region);
      setIncPattern(settings.incPattern);
    }
  }, [settings]);

  const handleSave = () => {
    if (!apiKey && !settings?.hasApiKey) {
      toast.error("Introduza uma API Key para continuar");
      return;
    }
    // Se não foi introduzida nova key, apenas atualizar região e padrão
    // O backend precisa da key para validar — se já existe, usamos um placeholder especial
    // Neste caso, o backend deve aceitar a key existente da BD
    if (!apiKey && settings?.hasApiKey) {
      // Apenas atualizar região e incPattern sem tocar na key
      // Fazemos uma chamada especial que preserva a key existente
      toast.info("A atualizar região e padrão INC...");
    }
    saveMutation.mutate({
      apiKey: apiKey || "__KEEP__",
      region: region as "us" | "eu" | "ca" | "au" | "ap",
      incPattern,
    });
  };

  return (
    <PageShell>
      <PageHeader
        title="Definições"
        description="Configure a ligação ao Rapid7 Insight Platform"
      />

      <div className="max-w-2xl space-y-6">
        {/* Estado da conexão */}
        {settings && (
          <div className={`flex items-center gap-3 p-4 rounded-lg border ${settings.hasApiKey
            ? "border-green-500/30 bg-green-500/5"
            : "border-yellow-500/30 bg-yellow-500/5"
            }`}>
            {settings.hasApiKey ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">API Key configurada</p>
                  <p className="text-xs text-muted-foreground">
                    Chave: <span className="font-mono">{settings.apiKeyPreview}</span> — Região: <span className="font-medium">{settings.region.toUpperCase()}</span>
                  </p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-yellow-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">API Key não configurada</p>
                  <p className="text-xs text-muted-foreground">Configure a API Key para começar a monitorizar</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Formulário */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            Credenciais Rapid7
          </h3>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="text-sm text-foreground">
              API Key do Insight Platform
            </Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? "text" : "password"}
                placeholder={settings?.hasApiKey ? "••••••••••••  (deixe vazio para manter a atual)" : "Cole aqui a sua API Key"}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setDirty(true); }}
                className="bg-input border-border pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Obtenha a sua API Key em: <span className="font-mono text-primary">Insight Platform → API Keys</span>
            </p>
          </div>

          {/* Região */}
          <div className="space-y-2">
            <Label className="text-sm text-foreground flex items-center gap-2">
              <Globe className="w-3.5 h-3.5" />
              Região
            </Label>
            <Select value={region} onValueChange={(v) => { setRegion(v); setDirty(true); }}>
              <SelectTrigger className="w-full bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {REGIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Selecione a região do seu tenant Rapid7 Insight Platform
            </p>
          </div>

          {/* Padrão INC */}
          <div className="space-y-2">
            <Label htmlFor="incPattern" className="text-sm text-foreground flex items-center gap-2">
              <Tag className="w-3.5 h-3.5" />
              Padrão de Referência INC
            </Label>
            <Input
              id="incPattern"
              placeholder="INC"
              value={incPattern}
              onChange={(e) => { setIncPattern(e.target.value.toUpperCase()); setDirty(true); }}
              className="bg-input border-border font-mono w-48"
              maxLength={16}
            />
            <p className="text-xs text-muted-foreground">
              Prefixo usado para detetar referências a incidentes nos comentários.
              Exemplos: <span className="font-mono text-primary">INC</span>, <span className="font-mono text-primary">RITM</span>, <span className="font-mono text-primary">CHG</span>, <span className="font-mono text-primary">TASK</span>
            </p>
            <p className="text-xs text-muted-foreground">
              O sistema deteta automaticamente padrões como <span className="font-mono">{incPattern}0001234</span> ou <span className="font-mono">{incPattern}-1234</span>
            </p>
          </div>

          {/* Botões */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || isLoading || (!dirty && settings?.hasApiKey)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saveMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />A guardar…</>
              ) : (
                "Guardar Configurações"
              )}
            </Button>
          </div>
        </div>

        {/* Cache */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Cache</h3>
          <p className="text-sm text-muted-foreground">
            Os dados das APIs do Rapid7 são guardados em cache por <span className="font-medium text-foreground">2 minutos</span> para evitar rate limiting.
            Limpe o cache para forçar a atualização imediata dos dados.
          </p>
          <Button
            variant="outline"
            onClick={() => clearCacheMutation.mutate()}
            disabled={clearCacheMutation.isPending}
            className="border-border bg-card hover:bg-accent"
          >
            {clearCacheMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />A limpar…</>
            ) : (
              "Limpar Cache"
            )}
          </Button>
        </div>

        {/* Info sobre APIs */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">APIs Utilizadas</h3>
          <div className="space-y-2 text-xs text-muted-foreground font-mono">
            <div className="flex gap-3">
              <span className="text-blue-400 shrink-0">GET</span>
              <span>/connect/v1/jobs?status=failed</span>
            </div>
            <div className="flex gap-3">
              <span className="text-blue-400 shrink-0">GET</span>
              <span>/connect/v2/workflows/{"{id}"}</span>
            </div>
            <div className="flex gap-3">
              <span className="text-blue-400 shrink-0">GET</span>
              <span>/idr/v2/investigations</span>
            </div>
            <div className="flex gap-3">
              <span className="text-blue-400 shrink-0">GET</span>
              <span>/idr/v2/investigations/{"{id}"}/comments</span>
            </div>
            <div className="flex gap-3">
              <span className="text-blue-400 shrink-0">GET</span>
              <span>/management/logs</span>
            </div>
            <div className="flex gap-3">
              <span className="text-blue-400 shrink-0">GET</span>
              <span>/management/logsets</span>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
