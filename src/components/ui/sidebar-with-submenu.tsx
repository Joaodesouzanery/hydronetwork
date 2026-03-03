"use client";
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Newspaper, FileText, Link2, BookOpen, BarChart3,
  HelpCircle, Settings, CreditCard, Receipt, Wallet, DollarSign,
  ChevronDown, LogOut, Sun, Moon, Mail, Linkedin,
} from "lucide-react";

type MenuItem = {
  name: string;
  href: string;
  icon?: React.ReactNode;
  routerLink?: boolean;
};

const Menu = ({ children, items }: { children: React.ReactNode; items: MenuItem[] }) => {
  const [isOpened, setIsOpened] = useState(false);
  return (
    <div>
      <button
        className="w-full flex items-center justify-between text-[#94A3B8] p-2 rounded-none hover:bg-[#FF6B2C]/5 hover:text-[#FF6B2C] active:bg-[#FF6B2C]/10 duration-150 font-mono text-sm"
        onClick={() => setIsOpened((v) => !v)}
        aria-expanded={isOpened}
        aria-controls="submenu"
      >
        <div className="flex items-center gap-x-2">{children}</div>
        <ChevronDown
          className={`w-4 h-4 duration-150 ${isOpened ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {isOpened && (
        <ul id="submenu" className="mx-4 px-2 border-l border-[#FF6B2C]/20 text-sm font-mono">
          {items.map((item, idx) => (
            <li key={idx}>
              <a
                href={item.href}
                className="flex items-center gap-x-2 text-[#94A3B8] p-2 rounded-none hover:bg-[#FF6B2C]/5 hover:text-[#FF6B2C] active:bg-[#FF6B2C]/10 duration-150"
              >
                {item.icon ? <div className="text-[#64748B]">{item.icon}</div> : null}
                {item.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const HubSidebar = () => {
  const location = useLocation();

  const navigation: MenuItem[] = [
    {
      href: "/hub-noticias",
      name: "Notícias",
      routerLink: true,
      icon: <Newspaper className="w-5 h-5" />,
    },
    {
      href: "/hub-noticias?tab=licitacoes",
      name: "Licitações",
      routerLink: true,
      icon: <FileText className="w-5 h-5" />,
    },
    {
      href: "/hub-noticias?tab=vinculos",
      name: "Grafo de Vínculos",
      routerLink: true,
      icon: <Link2 className="w-5 h-5" />,
    },
    {
      href: "/hub-noticias?tab=artigos",
      name: "Artigos",
      routerLink: true,
      icon: <BookOpen className="w-5 h-5" />,
    },
    {
      href: "/hub-noticias?tab=indicadores",
      name: "Indicadores",
      routerLink: true,
      icon: <BarChart3 className="w-5 h-5" />,
    },
  ];

  const navsFooter: MenuItem[] = [
    {
      href: "/help-center",
      name: "Ajuda",
      routerLink: true,
      icon: <HelpCircle className="w-5 h-5" />,
    },
    {
      href: "/settings",
      name: "Configurações",
      routerLink: true,
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  const nestedNav: MenuItem[] = [
    { name: "Fontes RSS", href: "/hub-noticias?tab=fontes", icon: <CreditCard className="w-4 h-4" /> },
    { name: "Coletas", href: "/hub-noticias?tab=coletas", icon: <Receipt className="w-4 h-4" /> },
    { name: "API PNCP", href: "/hub-noticias?tab=pncp", icon: <Wallet className="w-4 h-4" /> },
    { name: "Exportar Dados", href: "/hub-noticias?tab=exportar", icon: <DollarSign className="w-4 h-4" /> },
  ];

  const profileRef = useRef<HTMLButtonElement | null>(null);
  const [isProfileActive, setIsProfileActive] = useState(false);

  useEffect(() => {
    const handleProfile = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileActive(false);
      }
    };
    document.addEventListener("click", handleProfile);
    return () => document.removeEventListener("click", handleProfile);
  }, []);

  const isActive = (href: string) => {
    if (href === "/hub-noticias") return location.pathname === "/hub-noticias" && !location.search;
    if (href.includes("?")) {
      const tab = new URLSearchParams(href.split("?")[1]).get("tab");
      const currentTab = new URLSearchParams(location.search).get("tab");
      return currentTab === tab;
    }
    return location.pathname === href;
  };

  return (
    <nav
      className="fixed top-0 left-0 w-full h-full border-r border-[#FF6B2C]/10 space-y-8 sm:w-72 z-40"
      style={{
        background: "linear-gradient(180deg, #0A0A0A 0%, #111111 50%, #161616 100%)",
      }}
    >
      <div className="flex flex-col h-full px-4">
        {/* Header / Brand */}
        <div className="h-20 flex items-center pl-2 border-b border-[#FF6B2C]/10">
          <div className="w-full flex items-center gap-x-4">
            <div className="w-8 h-8 bg-[#FF6B2C] flex items-center justify-center flex-shrink-0">
              <span className="font-bold font-mono text-white text-sm">C</span>
            </div>
            <div>
              <span className="block text-white text-sm font-bold font-mono tracking-tight">
                Hub de Notícias
              </span>
              <span className="block mt-px text-[#FF6B2C]/60 text-xs font-mono">
                ConstruData
              </span>
            </div>
            <div className="relative flex-1 text-right">
              <button
                ref={profileRef}
                className="p-1.5 rounded-none text-[#64748B] hover:bg-[#FF6B2C]/10 active:bg-[#FF6B2C]/15"
                onClick={() => setIsProfileActive((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={isProfileActive}
                aria-controls="profile-menu"
              >
                <ChevronDown className="w-5 h-5" aria-hidden="true" />
              </button>
              {isProfileActive && (
                <div
                  id="profile-menu"
                  role="menu"
                  className="absolute z-10 top-12 right-0 w-64 bg-[#0A0A0A] shadow-lg border border-[#FF6B2C]/15 text-sm text-[#94A3B8] font-mono"
                >
                  <div className="p-2 text-left">
                    <span className="block text-[#64748B] p-2 text-xs">
                      construdata.contato@gmail.com
                    </span>
                    <NavLink
                      to="/dashboard"
                      className="block w-full p-2 text-left hover:bg-[#FF6B2C]/5 hover:text-[#FF6B2C] duration-150"
                      role="menuitem"
                    >
                      Voltar ao Dashboard
                    </NavLink>
                    <button className="block w-full p-2 text-left hover:bg-[#FF6B2C]/5 hover:text-[#FF6B2C] duration-150">
                      <LogOut className="w-4 h-4 inline mr-2" />
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="overflow-auto flex-1 py-4">
          <p className="uppercase text-[11px] tracking-[1.5px] font-bold font-mono text-[#FF6B2C]/50 px-2 mb-2">
            Conteúdo
          </p>
          <ul className="text-sm font-mono flex-1 space-y-0.5">
            {navigation.map((item, idx) => (
              <li key={idx}>
                {item.routerLink ? (
                  <NavLink
                    to={item.href}
                    className={() =>
                      `flex items-center gap-x-2 p-2 duration-150 ${
                        isActive(item.href)
                          ? "bg-[#FF6B2C]/15 text-[#FF6B2C] font-semibold border-l-[3px] border-l-[#FF6B2C] pl-3 rounded-none rounded-r-md"
                          : "text-[#94A3B8] hover:bg-[#FF6B2C]/5 hover:text-[#FF6B2C] rounded-none"
                      }`
                    }
                  >
                    <div className={isActive(item.href) ? "text-[#FF6B2C]" : "text-[#64748B]"}>
                      {item.icon}
                    </div>
                    {item.name}
                  </NavLink>
                ) : (
                  <a
                    href={item.href}
                    className="flex items-center gap-x-2 text-[#94A3B8] p-2 rounded-none hover:bg-[#FF6B2C]/5 hover:text-[#FF6B2C] active:bg-[#FF6B2C]/10 duration-150"
                  >
                    <div className="text-[#64748B]">{item.icon}</div>
                    {item.name}
                  </a>
                )}
              </li>
            ))}
            <li>
              <Menu items={nestedNav}>
                <CreditCard className="w-5 h-5 text-[#64748B]" />
                Dados & Fontes
              </Menu>
            </li>
          </ul>

          {/* Footer nav */}
          <div className="pt-2 mt-4 border-t border-[#FF6B2C]/10">
            <p className="uppercase text-[11px] tracking-[1.5px] font-bold font-mono text-[#FF6B2C]/50 px-2 mb-2">
              Sistema
            </p>
            <ul className="text-sm font-mono space-y-0.5">
              {navsFooter.map((item, idx) => (
                <li key={idx}>
                  <NavLink
                    to={item.href}
                    className="flex items-center gap-x-2 text-[#94A3B8] p-2 rounded-none hover:bg-[#FF6B2C]/5 hover:text-[#FF6B2C] active:bg-[#FF6B2C]/10 duration-150"
                  >
                    <div className="text-[#64748B]">{item.icon}</div>
                    {item.name}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#FF6B2C]/10">
          <div className="flex items-center gap-1.5 justify-center">
            <a
              href="mailto:construdata.contato@gmail.com"
              className="p-2 hover:bg-[#FF6B2C]/10 rounded transition-colors group"
              title="Email"
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
          <p className="text-[9px] font-mono text-[#444] text-center mt-1">
            construdata.contato@gmail.com
          </p>
        </div>
      </div>
    </nav>
  );
};

export default HubSidebar;
