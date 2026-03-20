import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Clients from "./pages/Clients";
import Servers from "./pages/Servers";
import Credentials from "./pages/Credentials";
import Links from "./pages/Links";
import Logs from "./pages/Logs";
import Permissions from "./pages/Permissions";
import Users from "./pages/Users";
import RdpSession from "./pages/RdpSession";
import AgentSetup from "./pages/AgentSetup";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import Monitoring from "./pages/Monitoring";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/clients" component={Clients} />
      <Route path="/servers" component={Servers} />
      <Route path="/credentials" component={Credentials} />
      <Route path="/links" component={Links} />
      <Route path="/logs" component={Logs} />
      <Route path="/permissions" component={Permissions} />
      <Route path="/users" component={Users} />
      <Route path="/rdp/:id" component={RdpSession} />
      <Route path="/agent" component={() => <AgentSetup />} />
      <Route path="/agent/:id" component={AgentSetup} />
      <Route path="/settings" component={Settings} />
      <Route path="/monitoring" component={Monitoring} />
      <Route path="/login" component={Login} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
