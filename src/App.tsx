import { lazy, Suspense } from "react";
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

// Eagerly loaded (landing & auth — critical path)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages for code splitting & faster initial load
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProductionControl = lazy(() => import("./pages/ProductionControl"));
const RDO = lazy(() => import("./pages/RDO"));
const RDONew = lazy(() => import("./pages/RDONew"));
const RDOHistory = lazy(() => import("./pages/RDOHistory"));
const RDOPhotos = lazy(() => import("./pages/RDOPhotos"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Settings = lazy(() => import("./pages/Settings"));
const ConnectionReports = lazy(() => import("./pages/ConnectionReports"));
const Occurrences = lazy(() => import("./pages/Occurrences"));
const Admin = lazy(() => import("./pages/Admin"));
const Backup = lazy(() => import("./pages/Backup"));
const Support = lazy(() => import("./pages/Support"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const SentimentDashboard = lazy(() => import("./pages/SentimentDashboard"));
const UserMetrics = lazy(() => import("./pages/UserMetrics"));
const CustomDashboard = lazy(() => import("./pages/CustomDashboard"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const HydroNetwork = lazy(() => import("./pages/HydroNetwork"));
const HydroNetworkLanding = lazy(() => import("./pages/HydroNetworkLanding"));
const ModulesCatalog = lazy(() => import("./pages/ModulesCatalog"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectHistory = lazy(() => import("./pages/ProjectHistory"));
const ProjectDelays = lazy(() => import("./pages/ProjectDelays"));
const InteractiveMap = lazy(() => import("./pages/InteractiveMap"));
const LeanConstraints = lazy(() => import("./pages/LeanConstraints"));
const LeanDashboard = lazy(() => import("./pages/LeanDashboard"));
const QADiagnostics = lazy(() => import("./pages/QADiagnostics"));
const ApprovalControl = lazy(() => import("./pages/ApprovalControl"));
const Tutorials = lazy(() => import("./pages/Tutorials"));
const HubNoticias = lazy(() => import("./pages/HubNoticias"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes before data is considered stale
      gcTime: 10 * 60 * 1000,   // 10 minutes before unused data is garbage collected
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <img src="/logo.svg" alt="ConstruData" className="h-10 mx-auto animate-pulse mb-3" />
      <p className="text-sm font-mono text-muted-foreground">Carregando...</p>
    </div>
  </div>
);

const AppContent = () => {
  useAlertNotifications();
  useProductionUpdates();

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
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
          <Route path="/qa" element={<ProtectedRoute><QADiagnostics /></ProtectedRoute>} />
          <Route path="/approval-control" element={<ProtectedRoute><ApprovalControl /></ProtectedRoute>} />
          <Route path="/tutorials" element={<ProtectedRoute><Tutorials /></ProtectedRoute>} />
          <Route path="/hub-noticias" element={<ProtectedRoute><HubNoticias /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
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
