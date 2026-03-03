import { useState, useEffect } from "react";
import {
  Home, Palette, Upload, Droplets, CloudRain, FileSpreadsheet, Calculator,
  Calendar, Beaker, Waves, Layers, FileText, Map, Shield, ClipboardList,
  Plus, History, Image, AlertCircle, Archive, HeadphonesIcon, Settings,
  BarChart3, ClipboardCheck, Activity, DollarSign, Building2, Bell, Clock,
  BookOpen, Smile, Mail, Linkedin, FileCheck2, GraduationCap,
  ChevronDown, EyeOff, Eye
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const STORAGE_KEY = "sidebar-hidden-sections";

interface SidebarSection {
  key: string;
  label: string;
  items: { title: string; url: string; icon: React.ComponentType<{ className?: string }> }[];
}

const sections: SidebarSection[] = [
  {
    key: "main",
    label: "Menu Principal",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: Home },
      { title: "Dashboard Personalizado", url: "/custom-dashboard", icon: Palette },
      { title: "Projetos", url: "/projects", icon: Building2 },
    ],
  },
  {
    key: "monitoring",
    label: "Monitoramento",
    items: [
      { title: "Alertas", url: "/alerts", icon: Bell },
      { title: "Atrasos de Projeto", url: "/project-delays", icon: Clock },
      { title: "LPS / Lean", url: "/hydronetwork/lps", icon: ClipboardCheck },
      { title: "Controle de Aprovação", url: "/approval-control", icon: FileCheck2 },
    ],
  },
  {
    key: "hydro",
    label: "HydroNetwork",
    items: [
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
    ],
  },
  {
    key: "rdo",
    label: "Diário de Obra",
    items: [
      { title: "RDO Hydro", url: "/hydronetwork/rdo", icon: ClipboardList },
      { title: "RDO × Planejamento", url: "/hydronetwork/rdo-planejamento", icon: BarChart3 },
      { title: "Novo RDO", url: "/rdo-new", icon: Plus },
      { title: "Histórico RDO", url: "/rdo-history", icon: History },
      { title: "Fotos de Validação", url: "/rdo-photos", icon: Image },
      { title: "Controle de Produção", url: "/production-control", icon: ClipboardList },
      { title: "Relatório de Ligações", url: "/connection-reports", icon: FileText },
      { title: "Ocorrências", url: "/occurrences", icon: AlertCircle },
    ],
  },
  {
    key: "system",
    label: "Sistema",
    items: [
      { title: "Tutoriais", url: "/tutorials", icon: GraduationCap },
      { title: "Central de Ajuda", url: "/help-center", icon: BookOpen },
      { title: "Suporte", url: "/support", icon: HeadphonesIcon },
      { title: "Sentimento", url: "/sentiment-dashboard", icon: Smile },
      { title: "Backup", url: "/backup", icon: Archive },
      { title: "Configurações", url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    sections.forEach((s) => {
      defaults[s.key] = s.key !== "system";
    });
    return defaults;
  });

  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hiddenSections));
  }, [hiddenSections]);

  const toggleExpanded = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleHidden = (key: string) => {
    setHiddenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "sidebar-item-active bg-[#FF6B2C]/15 text-[#FF6B2C] font-semibold border-l-[3px] border-l-[#FF6B2C] pl-3 rounded-none rounded-r-md"
      : "text-[#94A3B8] hover:bg-[#FF6B2C]/5 hover:text-[#FF6B2C] transition-all duration-200 rounded-md";

  const hiddenCount = Object.values(hiddenSections).filter(Boolean).length;

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-0"
      style={{
        background: "linear-gradient(180deg, #0A0A0A 0%, #111111 50%, #161616 100%)",
      }}
    >
      {/* Header with logo */}
      <SidebarHeader className="p-4 border-b border-[#FF6B2C]/10">
        <div className="flex items-center gap-2.5">
          {open ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#FF6B2C] flex items-center justify-center flex-shrink-0">
                <span className="font-bold font-mono text-white text-sm">C</span>
              </div>
              <span className="font-bold font-mono text-white text-lg tracking-tight">
                CONSTRUDATA
              </span>
            </div>
          ) : (
            <div className="w-7 h-7 bg-[#FF6B2C] flex items-center justify-center mx-auto">
              <span className="font-bold font-mono text-white text-sm">C</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto scrollbar-thin px-1">
        {sections.map((section) => {
          const isHidden = hiddenSections[section.key];
          const isExpanded = expandedSections[section.key];

          if (isHidden) return null;

          return (
            <SidebarGroup key={section.key} className="py-1">
              {/* Section header */}
              <div className="flex items-center justify-between px-3 py-2 group/header">
                <button
                  onClick={() => toggleExpanded(section.key)}
                  className="flex items-center gap-1.5 flex-1 min-w-0"
                >
                  <ChevronDown
                    className={`h-3 w-3 text-[#FF6B2C]/40 transition-transform duration-200 flex-shrink-0 ${
                      isExpanded ? "" : "-rotate-90"
                    }`}
                  />
                  <SidebarGroupLabel className="uppercase text-[11px] tracking-[1.5px] font-bold font-mono text-[#FF6B2C]/50 p-0 m-0 cursor-pointer hover:text-[#FF6B2C]/80 transition-colors">
                    {section.label}
                  </SidebarGroupLabel>
                </button>
                {open && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleHidden(section.key);
                    }}
                    className="opacity-0 group-hover/header:opacity-100 transition-opacity duration-150 p-1 hover:bg-[#FF6B2C]/10 rounded"
                    title={`Ocultar ${section.label}`}
                  >
                    <EyeOff className="h-3 w-3 text-[#555] hover:text-[#FF6B2C]" />
                  </button>
                )}
              </div>

              {/* Section items */}
              <div
                className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <SidebarGroupContent>
                  <SidebarMenu className="px-1 space-y-0.5">
                    {section.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild className="h-9">
                          <NavLink to={item.url} end className={getNavCls}>
                            <item.icon className="h-[16px] w-[16px] flex-shrink-0" />
                            <span className="text-[13px] font-mono truncate">{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </div>
            </SidebarGroup>
          );
        })}

        {/* Show hidden sections panel */}
        {hiddenCount > 0 && open && (
          <div className="px-3 py-2 mt-1">
            <div className="border border-dashed border-[#FF6B2C]/15 rounded-md p-2.5 bg-[#FF6B2C]/[0.02]">
              <p className="text-[10px] font-mono text-[#FF6B2C]/40 uppercase tracking-wider mb-2 font-bold">
                Módulos ocultos ({hiddenCount})
              </p>
              <div className="flex flex-wrap gap-1">
                {sections
                  .filter((s) => hiddenSections[s.key])
                  .map((s) => (
                    <button
                      key={s.key}
                      onClick={() => toggleHidden(s.key)}
                      className="flex items-center gap-1 text-[10px] font-mono text-[#666] hover:text-[#FF6B2C] bg-white/[0.03] hover:bg-[#FF6B2C]/10 px-2 py-1 rounded transition-colors"
                      title={`Mostrar ${s.label}`}
                    >
                      <Eye className="h-2.5 w-2.5" />
                      {s.label}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}
      </SidebarContent>

      {/* Footer with contact buttons - orange themed */}
      <SidebarFooter className="p-3 border-t border-[#FF6B2C]/10">
        <div className="flex items-center gap-1.5 justify-center">
          <a
            href="mailto:construdata.contato@gmail.com"
            className="p-2 hover:bg-[#FF6B2C]/10 rounded transition-colors group"
            title="Email: construdata.contato@gmail.com"
          >
            <Mail className="w-4 h-4 text-[#555] group-hover:text-[#FF6B2C] transition-colors" />
          </a>
          <a
            href="https://www.linkedin.com/company/construdatasoftware"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-[#FF6B2C]/10 rounded transition-colors group"
            title="LinkedIn"
          >
            <Linkedin className="w-4 h-4 text-[#555] group-hover:text-[#FF6B2C] transition-colors" />
          </a>
        </div>
        {open && (
          <p className="text-[9px] font-mono text-[#444] text-center mt-1">
            construdata.contato@gmail.com
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
