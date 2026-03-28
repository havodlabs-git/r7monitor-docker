import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { trpc } from "@/lib/trpc";

type Customer = {
  id: number;
  name: string;
  region: string;
  incPattern: string;
  apiKeyPreview: string;
  createdAt: Date;
};

type CustomerContextType = {
  customers: Customer[];
  selectedCustomer: Customer | null;
  selectedCustomerId: number | null;
  setSelectedCustomerId: (id: number | null) => void;
  isLoading: boolean;
  refetch: () => void;
};

const CustomerContext = createContext<CustomerContextType>({
  customers: [],
  selectedCustomer: null,
  selectedCustomerId: null,
  setSelectedCustomerId: () => {},
  isLoading: false,
  refetch: () => {},
});

const STORAGE_KEY = "r7monitor_selected_customer";

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [selectedCustomerId, setSelectedCustomerIdState] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? Number(stored) : null;
    } catch {
      return null;
    }
  });

  const { data: customers = [], isLoading, refetch } = trpc.customers.list.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Persistir seleção no localStorage
  const setSelectedCustomerId = (id: number | null) => {
    setSelectedCustomerIdState(id);
    try {
      if (id !== null) localStorage.setItem(STORAGE_KEY, String(id));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  // Auto-selecionar o primeiro customer se não houver seleção válida
  useEffect(() => {
    if (!isLoading && customers.length > 0) {
      const isValid = customers.some((c) => c.id === selectedCustomerId);
      if (!isValid) {
        setSelectedCustomerId(customers[0]!.id);
      }
    }
    if (!isLoading && customers.length === 0) {
      setSelectedCustomerId(null);
    }
  }, [customers, isLoading]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) ?? null;

  return (
    <CustomerContext.Provider value={{
      customers,
      selectedCustomer,
      selectedCustomerId,
      setSelectedCustomerId,
      isLoading,
      refetch,
    }}>
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  return useContext(CustomerContext);
}
