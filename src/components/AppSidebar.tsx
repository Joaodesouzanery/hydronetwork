import { useState, useEffect } from "react";
import {
  Home, Palette, Upload, Droplets, CloudRain, FileSpreadsheet, Calculator,
  Calendar, Beaker, Waves, Layers, FileText, Map, Shield, ClipboardList,
  Plus, History, Image, AlertCircle, Archive, HeadphonesIcon, Settings,
  BarChart3, ClipboardCheck, Activity
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Logo } from "@/components/shared/Logo";

const dashboardItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Dashboard Personalizado", url: "/custom-dashboard", icon: Palette },
];

const hydroModules = [
  { title: "Topografia", url: "/hydronetwork/topografia", icon: Upload },
  { title: "Esgoto", url: "/hydronetwork/esgoto", icon: Droplets },
  { title: "Água", url: "/hydronetwork/agua", icon: Droplets },
  { title: "Drenagem", url: "/hydronetwork/drenagem", icon: CloudRain },
  { title: "Quantitativos", url: "/hydronetwork/quantitativos", icon: FileSpreadsheet },
  { title: "Orçamento", url: "/hydronetwork/orcamento", icon: Calculator },
  { title: "Planejamento", url: "/hydronetwork/planejamento", icon: Calendar },
  { title: "EPANET", url: "/hydronetwork/epanet", icon: Beaker },
  { title: "EPANET PRO", url: "/hydronetwork/epanet-pro", icon: Beaker },
  { title: "SWMM", url: "/hydronetwork/swmm", icon: Waves },
  { title: "OpenProject", url: "/hydronetwork/openproject", icon: Layers },
  { title: "ProjectLibre", url: "/hydronetwork/projectlibre", icon: FileText },
  { title: "QGIS", url: "/hydronetwork/qgis", icon: Map },
  { title: "Revisão por Pares", url: "/hydronetwork/revisao", icon: Shield },
  { title: "Perfil Longitudinal", url: "/hydronetwork/perfil", icon: Activity },
  { title: "Mapa Interativo", url: "/hydronetwork/mapa", icon: Map },
  { title: "Exportação GIS", url: "/hydronetwork/exportacao", icon: FileSpreadsheet },
];

const rdoItems = [
  { title: "RDO Hydro", url: "/hydronetwork/rdo", icon: ClipboardList },
  { title: "Novo RDO", url: "/rdo-new", icon: Plus },
  { title: "Histórico RDO", url: "/rdo-history", icon: History },
  { title: "Fotos de Validação", url: "/rdo-photos", icon: Image },
  { title: "Controle de Produção", url: "/production-control", icon: ClipboardList },
  { title: "Relatório de Ligações", url: "/connection-reports", icon: FileText },
  { title: "Ocorrências", url: "/occurrences", icon: AlertCircle },
];

const settingsItems = [
  { title: "Backup", url: "/backup", icon: Archive },
  { title: "Suporte", url: "/support", icon: HeadphonesIcon },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

  const renderSection = (label: string, items: typeof dashboardItems, defaultOpen = true) => (
    <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel className="text-sm font-medium">{label}</SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Logo size="md" />
      </SidebarHeader>
      <SidebarContent>
        {renderSection("Menu Principal", dashboardItems)}
        {renderSection("HydroNetwork", hydroModules)}
        {renderSection("Diário de Obra", rdoItems)}
        {renderSection("Sistema", settingsItems, false)}
      </SidebarContent>
    </Sidebar>
  );
}
