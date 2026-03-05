import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LeanConstraintsContent } from '@/components/lean-constraints/LeanConstraintsContent';
import { PullDataPanel } from "@/components/shared/PullDataPanel";

const LeanConstraints = () => (
  <TooltipProvider>
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <PullDataPanel currentModule="lean" />
            <LeanConstraintsContent />
          </div>
        </main>
      </div>
    </SidebarProvider>
  </TooltipProvider>
);

export default LeanConstraints;
