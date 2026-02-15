import { useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RHDashboard } from "@/components/rh/RHDashboard";
import { EscalasCLT } from "@/components/rh/EscalasCLT";
import { Funcionarios } from "@/components/rh/Funcionarios";
import { Unidades } from "@/components/rh/Unidades";
import { DashboardPrimeCost } from "@/components/rh/DashboardPrimeCost";
import { FeriodosFaltas } from "@/components/rh/FeriodosFaltas";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Building2, 
  PieChart,
  CalendarOff
} from "lucide-react";

const RHConstruData = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col gap-1 sm:gap-2">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                RH ConstruData
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Gestão de recursos humanos, escalas CLT e controle de custos
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
                  <TabsTrigger value="escalas" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Escalas</span>
                  </TabsTrigger>
                  <TabsTrigger value="funcionarios" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Funcion.</span>
                  </TabsTrigger>
                  <TabsTrigger value="unidades" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Unidades</span>
                  </TabsTrigger>
                  <TabsTrigger value="feriados" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <CalendarOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Feriados</span>
                  </TabsTrigger>
                  <TabsTrigger value="prime-cost" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <PieChart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Prime Cost</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="dashboard" className="mt-0">
                <RHDashboard />
              </TabsContent>
              
              <TabsContent value="escalas" className="mt-0">
                <EscalasCLT />
              </TabsContent>
              
              <TabsContent value="funcionarios" className="mt-0">
                <Funcionarios />
              </TabsContent>
              
              <TabsContent value="unidades" className="mt-0">
                <Unidades />
              </TabsContent>
              
              <TabsContent value="feriados" className="mt-0">
                <FeriodosFaltas />
              </TabsContent>
              
              <TabsContent value="prime-cost" className="mt-0">
                <DashboardPrimeCost />
              </TabsContent>
            </Tabs>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default RHConstruData;
