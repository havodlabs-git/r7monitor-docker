import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CustomerProvider } from "./contexts/CustomerContext";
import R7Layout from "./pages/R7Layout";
import Dashboard from "./pages/Dashboard";
import Workflows from "./pages/Workflows";
import Investigations from "./pages/Investigations";
import LogSources from "./pages/LogSources";
import Settings from "./pages/Settings";
import Customers from "./pages/Customers";

function Router() {
  return (
    <R7Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/workflows" component={Workflows} />
        <Route path="/investigations" component={Investigations} />
        <Route path="/log-sources" component={LogSources} />
        <Route path="/customers" component={Customers} />
        <Route path="/settings" component={Settings} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </R7Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster richColors theme="dark" />
          <CustomerProvider>
            <Router />
          </CustomerProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
