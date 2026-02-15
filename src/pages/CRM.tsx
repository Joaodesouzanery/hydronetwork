import { useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CRMDashboard } from "@/components/crm/CRMDashboard";
import { CRMContacts } from "@/components/crm/CRMContacts";
import { CRMAccounts } from "@/components/crm/CRMAccounts";
import { CRMPipeline } from "@/components/crm/CRMPipeline";
import { CRMActivities } from "@/components/crm/CRMActivities";
import { CRMCalendar } from "@/components/crm/CRMCalendar";
import { CRMReports } from "@/components/crm/CRMReports";
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Target, 
  CheckSquare, 
  Calendar,
  BarChart3
} from "lucide-react";

const CRM = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col gap-1 sm:gap-2">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                CRM ConstruData
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Gestão completa de relacionamento com clientes
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
              {/* Mobile-friendly tabs with horizontal scroll */}
              <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                <TabsList className="inline-flex h-auto gap-1 bg-muted/50 p-1 min-w-max">
                  <TabsTrigger value="dashboard" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <LayoutDashboard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Dashboard</span>
                  </TabsTrigger>
                  <TabsTrigger value="contacts" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Contatos</span>
                  </TabsTrigger>
                  <TabsTrigger value="accounts" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Empresas</span>
                  </TabsTrigger>
                  <TabsTrigger value="pipeline" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Pipeline</span>
                  </TabsTrigger>
                  <TabsTrigger value="activities" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <CheckSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Atividades</span>
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Agenda</span>
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Relatórios</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="dashboard" className="mt-0">
                <CRMDashboard />
              </TabsContent>
              
              <TabsContent value="contacts" className="mt-0">
                <CRMContacts />
              </TabsContent>
              
              <TabsContent value="accounts" className="mt-0">
                <CRMAccounts />
              </TabsContent>
              
              <TabsContent value="pipeline" className="mt-0">
                <CRMPipeline />
              </TabsContent>
              
              <TabsContent value="activities" className="mt-0">
                <CRMActivities />
              </TabsContent>
              
              <TabsContent value="calendar" className="mt-0">
                <CRMCalendar />
              </TabsContent>
              
              <TabsContent value="reports" className="mt-0">
                <CRMReports />
              </TabsContent>
            </Tabs>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default CRM;
