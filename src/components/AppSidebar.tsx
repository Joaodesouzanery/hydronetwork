import { useState, useEffect } from "react";
import {
  Home, Palette, Upload, Droplets, CloudRain, FileSpreadsheet, Calculator,
  Calendar, Beaker, Waves, Layers, FileText, Map, Shield, ClipboardList,
  Plus, History, Image, AlertCircle, Archive, HeadphonesIcon, Settings,
  BarChart3, ClipboardCheck, Activity, DollarSign, Building2, Bell, Clock,
  BookOpen, Smile, Mail, Linkedin, Package, QrCode, Wrench, Users,
  Briefcase, UserCheck, Gauge, FolderOpen, Truck, Camera
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
  { title: "Dashboard 360°", url: "/dashboard-360", icon: Gauge },
  { title: "Dashboard Personalizado", url: "/custom-dashboard", icon: Palette },
  { title: "Projetos", url: "/projects", icon: Building2 },
  { title: "Dashboard Operacional", url: "/operational-dashboard", icon: BarChart3 },
];

const monitoringItems = [
  { title: "Alertas", url: "/alerts", icon: Bell },
  { title: "Atrasos de Projeto", url: "/project-delays", icon: Clock },
  { title: "Checklists", url: "/checklists", icon: ClipboardCheck },
  { title: "Aprovações", url: "/approvals", icon: Shield },
];

const hydroModules = [
  { title: "Topografia", url: "/hydronetwork/topografia", icon: Upload },
  { title: "Esgoto", url: "/hydronetwork/esgoto", icon: Droplets },
  { title: "Água", url: "/hydronetwork/agua", icon: Droplets },
  { title: "Drenagem", url: "/hydronetwork/drenagem", icon: CloudRain },
  { title: "Quantitativos", url: "/hydronetwork/quantitativos", icon: FileSpreadsheet },
  { title: "Orçamento", url: "/hydronetwork/orcamento", icon: Calculator },
  { title: "BDI", url: "/hydronetwork/bdi", icon: DollarSign },
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
  { title: "RDO × Planejamento", url: "/hydronetwork/rdo-planejamento", icon: BarChart3 },
  { title: "Novo RDO", url: "/rdo-new", icon: Plus },
  { title: "Histórico RDO", url: "/rdo-history", icon: History },
  { title: "Fotos de Validação", url: "/rdo-photos", icon: Image },
  { title: "Controle de Produção", url: "/production-control", icon: ClipboardList },
  { title: "Relatório de Ligações", url: "/connection-reports", icon: FileText },
  { title: "Ocorrências", url: "/occurrences", icon: AlertCircle },
];

const materiaisItems = [
  { title: "Materiais", url: "/materials", icon: Package },
  { title: "Controle de Materiais", url: "/material-control", icon: Truck },
  { title: "Requisição de Materiais", url: "/material-requests", icon: FolderOpen },
  { title: "Dashboard de Materiais", url: "/materials-dashboard", icon: BarChart3 },
  { title: "Inventário", url: "/inventory", icon: Archive },
  { title: "Orçamentos", url: "/budgets", icon: DollarSign },
  { title: "Precificação", url: "/prices", icon: Calculator },
];

const manutencaoItems = [
  { title: "Tarefas de Manutenção", url: "/maintenance-tasks", icon: Wrench },
  { title: "QR Codes", url: "/maintenance-qrcodes", icon: QrCode },
  { title: "Solicitações", url: "/maintenance-requests", icon: ClipboardList },
  { title: "Gestão Predial", url: "/facility-reports", icon: Building2 },
  { title: "Catálogo de Ativos", url: "/assets-catalog", icon: Package },
  { title: "Consumo", url: "/consumption-control", icon: Gauge },
];

const pessoalItems = [
  { title: "Funcionários", url: "/employees", icon: Users },
  { title: "RH & Escalas CLT", url: "/rh", icon: UserCheck },
  { title: "Mão de Obra", url: "/labor-tracking", icon: Clock },
  { title: "CRM", url: "/crm", icon: Briefcase },
];

const settingsItems = [
  { title: "Central de Ajuda", url: "/help-center", icon: BookOpen },
  { title: "Suporte", url: "/support", icon: HeadphonesIcon },
  { title: "Sentimento", url: "/sentiment-dashboard", icon: Smile },
  { title: "Backup", url: "/backup", icon: Archive },
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
        {renderSection("Monitoramento", monitoringItems)}
        {renderSection("HydroNetwork", hydroModules, false)}
        {renderSection("Diário de Obra", rdoItems, false)}
        {renderSection("Materiais & Almoxarifado", materiaisItems, false)}
        {renderSection("Manutenção", manutencaoItems, false)}
        {renderSection("Pessoal & CRM", pessoalItems, false)}
        {renderSection("Sistema", settingsItems, false)}

        {/* Support footer */}
        <div className="mt-auto p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2 justify-center">
            <a href="mailto:construdata.contato@gmail.com" className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors" title="Email: construdata.contato@gmail.com">
              <Mail className="w-4 h-4 text-muted-foreground" />
            </a>
            <a href="https://www.linkedin.com/company/construdatasoftware" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors" title="LinkedIn">
              <Linkedin className="w-4 h-4 text-muted-foreground" />
            </a>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
