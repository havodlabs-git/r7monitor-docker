import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Loader2 } from "lucide-react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const [location, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">A verificar sessão...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(location);
    setLocation(`/login?returnTo=${returnTo}`);
    return null;
  }

  return <>{children}</>;
}
