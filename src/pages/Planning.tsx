import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Badge } from "@/components/ui/badge";
import { Construction } from "lucide-react";
import { PlanningHome } from "@/components/planning/PlanningHome";
import { NewProjectForm } from "@/components/planning/NewProjectForm";
import { ProjectResults } from "@/components/planning/ProjectResults";
import type { ProjectData } from "@/components/planning/planningUtils";

type View = "home" | "new" | "results";

const Planning = () => {
  const [view, setView] = useState<View>("home");
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);

  const handleComplete = (project: ProjectData) => {
    setCurrentProject(project);
    setView("results");
  };

  const handleOpenProject = (project: ProjectData) => {
    setCurrentProject(project);
    setView("results");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              <SidebarTrigger />
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Construction className="h-5 w-5" />
                  Planejamento
                </h1>
              </div>
            </div>

            {/* Banner */}
            <div className="mb-6">
              <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-600 bg-yellow-500/10">
                ⚠️ Funcionalidade em desenvolvimento
              </Badge>
            </div>

            {/* Content */}
            {view === "home" && (
              <PlanningHome onNewProject={() => setView("new")} onOpenProject={handleOpenProject} />
            )}
            {view === "new" && (
              <NewProjectForm onComplete={handleComplete} onCancel={() => setView("home")} />
            )}
            {view === "results" && currentProject && (
              <ProjectResults
                project={currentProject}
                onBack={() => setView("home")}
                onEdit={() => setView("new")}
              />
            )}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Planning;
