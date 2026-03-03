import { useState, useEffect } from "react";
import {
  Home, Palette, Upload, Droplets, CloudRain, FileSpreadsheet, Calculator,
  Calendar, Beaker, Waves, Layers, FileText, Map, Shield, ClipboardList,
  Plus, History, Image, AlertCircle, Archive, HeadphonesIcon, Settings,
  BarChart3, ClipboardCheck, Activity, DollarSign, Building2, Bell, Clock,
  BookOpen, Smile, Mail, Linkedin, FileCheck2
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";

const dashboardItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Dashboard Personalizado", url: "/custom-dashboard", icon: Palette },
  { title: "Projetos", url: "/projects", icon: Building2 },
];

const monitoringItems = [
  { title: "Alertas", url: "/alerts", icon: Bell },
  { title: "Atrasos de Projeto", url: "/project-delays", icon: Clock },
  { title: "LPS / Lean", url: "/hydronetwork/lps", icon: ClipboardCheck },
  { title: "Controle de Aprovação", url: "/approval-control", icon: FileCheck2 },
];

const hydroModules = [
  { title: "Topografia", url: "/hydronetwork/topografia", icon: Upload },
  { title: "Esgoto", url: "/hydronetwork/esgoto", icon: Waves },
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
  { title: "Orçamento de Elevatória", url: "/hydronetwork/elevatoria", icon: Activity },
  { title: "Recalque / Booster", url: "/hydronetwork/recalque", icon: Activity },
  { title: "Transientes Hidráulicos", url: "/hydronetwork/transientes", icon: Activity },
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
      ? "sidebar-item-active bg-[rgba(255,107,44,0.08)] text-[#FF6B2C] font-medium border-l-[3px] border-l-[#FF6B2C] pl-3"
      : "text-[#94A3B8] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F8FAFC] transition-colors duration-200";

  const renderSection = (label: string, items: typeof dashboardItems, defaultOpen = true) => (
    <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel className="uppercase text-[11px] tracking-[1.5px] font-semibold font-mono text-[#666666] px-4">
          {label}
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span className="text-sm font-mono">{item.title}</span>
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
    <Sidebar
      collapsible="icon"
      className="border-r-0"
      style={{
        background: "linear-gradient(180deg, #111111 0%, #1A1A1A 100%)",
      }}
    >
      <SidebarHeader className="p-4 border-b border-[#2A2A2A]">
        <div className="flex items-center gap-2.5">
          <img
            src="/favicon.svg"
            alt="ConstruData"
            className="h-10 w-10 flex-shrink-0"
          />
          {open && (
            <span className="text-lg font-bold font-mono text-white tracking-tight">
              CONSTRUDATA
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="overflow-y-auto">
        {renderSection("Menu Principal", dashboardItems)}
        {renderSection("Monitoramento", monitoringItems)}
        {renderSection("HydroNetwork", hydroModules)}
        {renderSection("Diário de Obra", rdoItems)}
        {renderSection("Sistema", settingsItems, false)}

        {/* Support footer */}
        <div className="mt-auto p-3 border-t border-[#2A2A2A]">
          <div className="flex items-center gap-2 justify-center">
            <a href="mailto:construdata.contato@gmail.com" className="p-2 hover:bg-[rgba(255,255,255,0.05)] transition-colors" title="Email">
              <Mail className="w-4 h-4 text-[#94A3B8]" />
            </a>
            <a href="https://www.linkedin.com/company/construdatasoftware" target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-[rgba(255,255,255,0.05)] transition-colors" title="LinkedIn">
              <Linkedin className="w-4 h-4 text-[#94A3B8]" />
            </a>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
