import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAlertNotifications } from "@/hooks/useAlertNotifications";
import { useProductionUpdates } from "@/hooks/useProductionUpdates";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import MaintenanceOverlay from "@/components/MaintenanceOverlay";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
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
import HelpCenter from "./pages/HelpCenter";
import SentimentDashboard from "./pages/SentimentDashboard";
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
import InteractiveMap from "./pages/InteractiveMap";
import LeanConstraints from "./pages/LeanConstraints";
import LeanDashboard from "./pages/LeanDashboard";

const queryClient = new QueryClient();

const AppContent = () => {
  useAlertNotifications();
  useProductionUpdates();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/hydronetwork-landing" element={<HydroNetworkLanding />} />

        {/* Protected routes - require authentication */}
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/custom-dashboard" element={<ProtectedRoute><CustomDashboard /></ProtectedRoute>} />
        <Route path="/production-control" element={<ProtectedRoute><ProductionControl /></ProtectedRoute>} />
        <Route path="/rdo" element={<ProtectedRoute><RDO /></ProtectedRoute>} />
        <Route path="/rdo-new" element={<ProtectedRoute><RDONew /></ProtectedRoute>} />
        <Route path="/rdo-history" element={<ProtectedRoute><RDOHistory /></ProtectedRoute>} />
        <Route path="/rdo-photos" element={<ProtectedRoute><RDOPhotos /></ProtectedRoute>} />
        <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/connection-reports" element={<ProtectedRoute><ConnectionReports /></ProtectedRoute>} />
        <Route path="/occurrences" element={<ProtectedRoute><Occurrences /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        <Route path="/admin/metrics" element={<ProtectedRoute><UserMetrics /></ProtectedRoute>} />
        <Route path="/backup" element={<ProtectedRoute><Backup /></ProtectedRoute>} />
        <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
        <Route path="/help-center" element={<ProtectedRoute><HelpCenter /></ProtectedRoute>} />
        <Route path="/sentiment-dashboard" element={<ProtectedRoute><SentimentDashboard /></ProtectedRoute>} />
        <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
        <Route path="/projects/:id/history" element={<ProtectedRoute><ProjectHistory /></ProtectedRoute>} />
        <Route path="/project-delays" element={<ProtectedRoute><ProjectDelays /></ProtectedRoute>} />
        <Route path="/projects/:projectId/map" element={<ProtectedRoute><InteractiveMap /></ProtectedRoute>} />
        <Route path="/lean-constraints" element={<ProtectedRoute><LeanConstraints /></ProtectedRoute>} />
        <Route path="/lean-dashboard" element={<ProtectedRoute><LeanDashboard /></ProtectedRoute>} />
        <Route path="/hydronetwork" element={<ProtectedRoute><HydroNetwork /></ProtectedRoute>} />
        <Route path="/hydronetwork/:module" element={<ProtectedRoute><HydroNetwork /></ProtectedRoute>} />
        <Route path="/modules" element={<ProtectedRoute><ModulesCatalog /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <FeedbackWidget />
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <MaintenanceOverlay />
        <Toaster />
        <Sonner />
        <AppContent />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
