import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAlertNotifications } from "@/hooks/useAlertNotifications";
import { useProductionUpdates } from "@/hooks/useProductionUpdates";
import MaintenanceOverlay from "@/components/MaintenanceOverlay";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ProductionControl from "./pages/ProductionControl";
import RDO from "./pages/RDO";
import RDONew from "./pages/RDONew";
import RDOHistory from "./pages/RDOHistory";
import RDOPhotos from "./pages/RDOPhotos";
import Alerts from "./pages/Alerts";
import Settings from "./pages/Settings";
import ConnectionReports from "./pages/ConnectionReports";
import Occurrences from "./pages/Occurrences";
import Admin from "./pages/Admin";
import Backup from "./pages/Backup";
import Support from "./pages/Support";
import UserMetrics from "./pages/UserMetrics";
import CustomDashboard from "./pages/CustomDashboard";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import HydroNetwork from "./pages/HydroNetwork";
import HydroNetworkLanding from "./pages/HydroNetworkLanding";
import ModulesCatalog from "./pages/ModulesCatalog";
import Projects from "./pages/Projects";
import ProjectHistory from "./pages/ProjectHistory";
import ProjectDelays from "./pages/ProjectDelays";

const queryClient = new QueryClient();

const AppContent = () => {
  useAlertNotifications();
  useProductionUpdates();
  
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/custom-dashboard" element={<CustomDashboard />} />
        <Route path="/production-control" element={<ProductionControl />} />
        <Route path="/rdo" element={<RDO />} />
        <Route path="/rdo-new" element={<RDONew />} />
        <Route path="/rdo-history" element={<RDOHistory />} />
        <Route path="/rdo-photos" element={<RDOPhotos />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/connection-reports" element={<ConnectionReports />} />
        <Route path="/occurrences" element={<Occurrences />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/metrics" element={<UserMetrics />} />
        <Route path="/backup" element={<Backup />} />
        <Route path="/support" element={<Support />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id/history" element={<ProjectHistory />} />
        <Route path="/project-delays" element={<ProjectDelays />} />
        <Route path="/hydronetwork" element={<HydroNetwork />} />
        <Route path="/hydronetwork/:module" element={<HydroNetwork />} />
        <Route path="/hydronetwork-landing" element={<HydroNetworkLanding />} />
        <Route path="/modules" element={<ModulesCatalog />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <MaintenanceOverlay />
      <Toaster />
      <Sonner />
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
