import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  GitBranch,
  Search,
  Database,
  Monitor,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  RefreshCw,
  Building2,
  ChevronDown,
  Check,
  Plus,
  LogOut,
  User,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useCustomer } from "@/contexts/CustomerContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/workflows", label: "Workflows", icon: GitBranch },
  { path: "/investigations", label: "Investigations", icon: Search },
  { path: "/log-sources", label: "Log Sources", icon: Database },
  { path: "/assets", label: "Assets", icon: Monitor },
];

const BOTTOM_NAV = [
  { path: "/customers", label: "Customers", icon: Building2 },
  { path: "/settings", label: "Definições", icon: Settings },
];

export default function R7Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [location, setLocation] = useLocation();
  const { customers, selectedCustomer, setSelectedCustomerId } = useCustomer();

  const { user, logout } = useAuth();

  const clearCache = trpc.settings.clearCache.useMutation({
    onSuccess: () => toast.success("Cache limpo com sucesso"),
    onError: () => toast.error("Erro ao limpar cache"),
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-border transition-all duration-300 shrink-0",
          "bg-sidebar",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center gap-3 px-4 py-5 border-b border-sidebar-border",
          collapsed && "justify-center px-2"
        )}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shrink-0">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-sidebar-foreground leading-tight">R7 Monitor</p>
              <p className="text-[10px] text-muted-foreground leading-tight truncate">Rapid7 InsightIDR</p>
            </div>
          )}
        </div>

        {/* Customer selector */}
        {!collapsed && (
          <div className="px-2 py-2 border-b border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors text-left">
                  <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center shrink-0">
                    <Building2 className="w-3 h-3 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {selectedCustomer ? (
                      <>
                        <p className="text-xs font-medium text-sidebar-foreground truncate">{selectedCustomer.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">{selectedCustomer.region}</p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Selecionar customer</p>
                    )}
                  </div>
                  <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 bg-card border-border"
                align="start"
                side="right"
              >
                {customers.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum customer configurado</div>
                ) : (
                  customers.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Check className={cn("w-3.5 h-3.5 shrink-0", selectedCustomer?.id === c.id ? "text-primary" : "opacity-0")} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground uppercase">{c.region}</p>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={() => setLocation("/customers")}
                  className="flex items-center gap-2 cursor-pointer text-primary"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="text-sm">Gerir Customers</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Nav principal */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const isActive = path === "/" ? location === "/" : location.startsWith(path);
            return (
              <Link key={path} href={path}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  collapsed && "justify-center px-2"
                )}>
                  <Icon className={cn("w-4 h-4 shrink-0", isActive && "text-primary")} />
                  {!collapsed && <span className="text-sm font-medium truncate">{label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Nav inferior */}
        <div className="border-t border-sidebar-border px-2 py-2 space-y-1">
          {BOTTOM_NAV.map(({ path, label, icon: Icon }) => {
            const isActive = location.startsWith(path);
            return (
              <Link key={path} href={path}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  collapsed && "justify-center px-2"
                )}>
                  <Icon className={cn("w-4 h-4 shrink-0", isActive && "text-primary")} />
                  {!collapsed && <span className="text-sm truncate">{label}</span>}
                </div>
              </Link>
            );
          })}

          {/* Refresh cache */}
          <button
            onClick={() => clearCache.mutate()}
            disabled={clearCache.isPending}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors",
              "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm",
              collapsed && "justify-center px-2"
            )}
            title="Limpar cache"
          >
            <RefreshCw className={cn("w-4 h-4 shrink-0", clearCache.isPending && "animate-spin")} />
            {!collapsed && <span className="text-xs">Limpar Cache</span>}
          </button>

          {/* User info + logout */}
          {!collapsed && user && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent/30">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <User className="w-3 h-3 text-primary" />
              </div>
              <span className="text-xs text-sidebar-foreground flex-1 truncate">{user.name ?? user.username}</span>
              <button
                onClick={() => logout()}
                className="text-muted-foreground hover:text-destructive transition-colors"
                title="Terminar sessão"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors",
              "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              collapsed && "justify-center px-2"
            )}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span className="text-xs">Recolher</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
