import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [mode, setMode]         = useState<Mode>("login");
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [form, setForm] = useState({
    username: "",
    password: "",
    name:     "",
    email:    "",
  });

  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      const params = new URLSearchParams(window.location.search);
      setLocation(params.get("returnTo") ?? "/");
    },
    onError: (err) => setError(err.message),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      const params = new URLSearchParams(window.location.search);
      setLocation(params.get("returnTo") ?? "/");
    },
    onError: (err) => setError(err.message),
  });

  const isPending = loginMutation.isPending || registerMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "login") {
      loginMutation.mutate({ username: form.username, password: form.password });
    } else {
      registerMutation.mutate({
        username: form.username,
        password: form.password,
        name:     form.name || undefined,
        email:    form.email || undefined,
      });
    }
  };

  const field = (key: keyof typeof form) => ({
    value:    form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setError(null);
    },
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/30">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">R7 Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">Rapid7 InsightIDR</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
          {/* Tabs */}
          <div className="flex rounded-lg bg-muted p-1 mb-6">
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); }}
                className={cn(
                  "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                  mode === m
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "login" ? "Entrar" : "Registar"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm text-foreground">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="utilizador"
                autoComplete="username"
                required
                disabled={isPending}
                className="bg-background border-border"
                {...field("username")}
              />
            </div>

            {/* Name (only register) */}
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm text-foreground">
                  Nome <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="João Silva"
                  disabled={isPending}
                  className="bg-background border-border"
                  {...field("name")}
                />
              </div>
            )}

            {/* Email (only register) */}
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm text-foreground">
                  Email <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="joao@empresa.com"
                  disabled={isPending}
                  className="bg-background border-border"
                  {...field("email")}
                />
              </div>
            )}

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm text-foreground">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? "text" : "password"}
                  placeholder={mode === "register" ? "Mínimo 8 caracteres" : "••••••••"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  disabled={isPending}
                  className="bg-background border-border pr-10"
                  {...field("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === "login" ? (
                "Entrar"
              ) : (
                "Criar conta"
              )}
            </Button>
          </form>

          {/* Nota sobre primeiro utilizador */}
          {mode === "register" && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              O primeiro utilizador registado torna-se automaticamente administrador.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
