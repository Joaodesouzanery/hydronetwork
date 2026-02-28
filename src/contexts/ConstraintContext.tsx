/**
 * ConstraintProvider Context
 *
 * Reduces prop drilling in LeanConstraints and LeanDashboard pages by
 * providing shared state for projects, filters, service fronts, and
 * constraint operations through React Context.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useLeanConstraints } from "@/hooks/useLeanConstraints";
import type { ConstraintFilters } from "@/types/lean-constraints";

interface ConstraintContextValue {
  // Auth
  userId: string;
  userName: string;
  // Projects
  projects: { id: string; name: string }[];
  currentProjectName: string;
  // Filters
  filters: ConstraintFilters;
  setFilters: React.Dispatch<React.SetStateAction<ConstraintFilters>>;
  // Related entities
  serviceFronts: { id: string; name: string }[];
  employees: { id: string; name: string }[];
  services: { id: string; name: string }[];
  // Constraint hook results
  constraintState: ReturnType<typeof useLeanConstraints>;
}

const ConstraintContext = createContext<ConstraintContextValue | null>(null);

export function useConstraintContext() {
  const ctx = useContext(ConstraintContext);
  if (!ctx) throw new Error("useConstraintContext must be used within ConstraintProvider");
  return ctx;
}

interface ConstraintProviderProps {
  children: ReactNode;
  /** Load employees and services (needed for LeanConstraints but not Dashboard) */
  loadRelatedEntities?: boolean;
}

export function ConstraintProvider({ children, loadRelatedEntities = false }: ConstraintProviderProps) {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("Usuário");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [serviceFronts, setServiceFronts] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState<ConstraintFilters>({
    status: "todas",
    tipo: "todos",
    impacto: "todos",
  });

  const constraintState = useLeanConstraints(filters);

  // Auth + projects
  useEffect(() => {
    const init = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        navigate("/auth");
        return;
      }
      setUserId(session.session.user.id);
      setUserName(session.session.user.email?.split("@")[0] || "Usuário");

      const { data: projs } = await supabase
        .from("projects")
        .select("id, name")
        .in("status", ["active", "paused"])
        .order("name");
      if (projs) {
        setProjects(projs);
        if (projs.length > 0 && !filters.projectId) {
          setFilters(prev => ({ ...prev, projectId: projs[0].id }));
        }
      }
    };
    init();
  }, [navigate]);

  // Load related entities when project changes
  useEffect(() => {
    if (!filters.projectId) return;

    const loadData = async () => {
      const promises: Promise<any>[] = [
        supabase
          .from("service_fronts")
          .select("id, name")
          .eq("project_id", filters.projectId!)
          .order("name"),
      ];

      if (loadRelatedEntities) {
        promises.push(
          supabase.from("employees").select("id, name").order("name"),
          supabase.from("services_catalog").select("id, name").order("name").limit(100),
        );
      }

      const results = await Promise.all(promises);
      setServiceFronts(results[0].data ?? []);
      if (loadRelatedEntities) {
        setEmployees(results[1]?.data ?? []);
        setServices(results[2]?.data ?? []);
      }
    };
    loadData();
  }, [filters.projectId, loadRelatedEntities]);

  const currentProjectName = projects.find(p => p.id === filters.projectId)?.name || "Projeto";

  return (
    <ConstraintContext.Provider
      value={{
        userId,
        userName,
        projects,
        currentProjectName,
        filters,
        setFilters,
        serviceFronts,
        employees,
        services,
        constraintState,
      }}
    >
      {children}
    </ConstraintContext.Provider>
  );
}
