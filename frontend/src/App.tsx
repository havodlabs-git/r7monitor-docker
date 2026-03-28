import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { CustomerProvider } from "./contexts/CustomerContext";
import R7Layout from "./pages/R7Layout";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import Workflows from "./pages/Workflows";
import Investigations from "./pages/Investigations";
import LogSources from "./pages/LogSources";
import Settings from "./pages/Settings";
import Customers from "./pages/Customers";

function AppRoutes() {
  return (
    <Switch>
      {/* Rota pública */}
      <Route path="/login" component={LoginPage} />

      {/* Rotas protegidas */}
      <Route>
        <ProtectedRoute>
          <CustomerProvider>
            <R7Layout>
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/workflows" component={Workflows} />
                <Route path="/investigations" component={Investigations} />
                <Route path="/log-sources" component={LogSources} />
                <Route path="/customers" component={Customers} />
                <Route path="/settings" component={Settings} />
                <Route>
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Página não encontrada
                  </div>
                </Route>
              </Switch>
            </R7Layout>
          </CustomerProvider>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster richColors theme="dark" />
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
