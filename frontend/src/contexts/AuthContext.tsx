import { createContext, useContext, ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";

export interface AuthUser {
  id:       number;
  username: string;
  name?:    string | null;
  email?:   string | null;
  role:     "user" | "admin";
}

interface AuthContextValue {
  user:            AuthUser | null;
  loading:         boolean;
  isAuthenticated: boolean;
  logout:          () => Promise<void>;
  refresh:         () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
      utils.auth.me.invalidate();
    },
  });

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (err) {
      if (err instanceof TRPCClientError && err.data?.code === "UNAUTHORIZED") return;
      throw err;
    }
  };

  const value: AuthContextValue = {
    user:            (meQuery.data as AuthUser) ?? null,
    loading:         meQuery.isLoading || logoutMutation.isPending,
    isAuthenticated: Boolean(meQuery.data),
    logout,
    refresh:         () => meQuery.refetch(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
