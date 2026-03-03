import { useState, useEffect } from "react";
import {
  Home, Palette, Upload, Droplets, CloudRain, FileSpreadsheet, Calculator,
  Calendar, Beaker, Waves, Layers, FileText, Map, Shield, ClipboardList,
  Plus, History, Image, AlertCircle, Archive, HeadphonesIcon, Settings,
  BarChart3, ClipboardCheck, Activity, DollarSign, Building2, Bell, Clock,
  BookOpen, Smile, Mail, Linkedin, FileCheck2,
  ChevronDown, EyeOff, Eye
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { LogoText } from "@/components/shared/Logo";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, useSidebar,
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

  // Track which sections are expanded (open) vs collapsed
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    sections.forEach((s) => {
      defaults[s.key] = s.key !== "system";
    });
    return defaults;
  });

  // Track which sections are hidden (completely removed from sidebar)
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
      ? "sidebar-item-active bg-[#FF6B2C]/10 text-[#FF6B2C] font-medium border-l-[3px] border-l-[#FF6B2C] pl-3 rounded-r-md"
      : "text-[#94A3B8] hover:bg-white/[0.04] hover:text-[#E2E8F0] transition-all duration-150 rounded-r-md";

  const hiddenCount = Object.values(hiddenSections).filter(Boolean).length;

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-0"
      style={{
        background: "linear-gradient(180deg, #0F0F0F 0%, #161616 50%, #1A1A1A 100%)",
      }}
    >
      {/* Header with logo */}
      <SidebarHeader className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <img
            src="/favicon.svg"
            alt="ConstruData"
            className="h-9 w-9 flex-shrink-0"
          />
          {open && (
            <LogoText className="text-lg tracking-tight" textColor="text-white" />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto scrollbar-thin">
        {sections.map((section) => {
          const isHidden = hiddenSections[section.key];
          const isExpanded = expandedSections[section.key];

          if (isHidden) return null;

          return (
            <SidebarGroup key={section.key} className="py-1">
              {/* Section header with expand/collapse toggle and hide button */}
              <div className="flex items-center justify-between px-3 py-1.5 group/header">
                <button
                  onClick={() => toggleExpanded(section.key)}
                  className="flex items-center gap-1.5 flex-1 min-w-0"
                >
                  <ChevronDown
                    className={`h-3 w-3 text-[#555] transition-transform duration-200 flex-shrink-0 ${
                      isExpanded ? "" : "-rotate-90"
                    }`}
                  />
                  <SidebarGroupLabel className="uppercase text-[10px] tracking-[1.5px] font-semibold font-mono text-[#555] p-0 m-0 cursor-pointer hover:text-[#888] transition-colors">
                    {section.label}
                  </SidebarGroupLabel>
                </button>
                {open && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleHidden(section.key);
                    }}
                    className="opacity-0 group-hover/header:opacity-100 transition-opacity duration-150 p-1 hover:bg-white/[0.06] rounded"
                    title={`Ocultar ${section.label}`}
                  >
                    <EyeOff className="h-3 w-3 text-[#555] hover:text-[#999]" />
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
                  <SidebarMenu className="px-1">
                    {section.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild className="h-8">
                          <NavLink to={item.url} end className={getNavCls}>
                            <item.icon className="h-4 w-4 flex-shrink-0" />
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
            <div className="border border-dashed border-white/[0.08] rounded-md p-2">
              <p className="text-[10px] font-mono text-[#555] uppercase tracking-wider mb-1.5">
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

        {/* Footer */}
        <div className="mt-auto p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 justify-center">
            <a
              href="mailto:construdata.contato@gmail.com"
              className="p-2 hover:bg-white/[0.05] rounded transition-colors"
              title="Email"
            >
              <Mail className="w-4 h-4 text-[#666]" />
            </a>
            <a
              href="https://www.linkedin.com/company/construdatasoftware"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-white/[0.05] rounded transition-colors"
              title="LinkedIn"
            >
              <Linkedin className="w-4 h-4 text-[#666]" />
            </a>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
