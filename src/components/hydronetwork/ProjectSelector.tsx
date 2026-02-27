/**
 * ProjectSelector — Dropdown for managing multiple named projects.
 * Save, load, switch, and delete projects (localStorage + Supabase).
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Save, FolderOpen, Plus, Trash2, ChevronDown } from "lucide-react";
import {
  listAllProjects,
  saveProjectAs,
  deleteProject,
  loadProjectFromSupabase,
  syncProjectToSupabase,
  type ProjectListItem,
  type HydroProjectSave,
} from "@/engine/sharedPlanningStore";

interface ProjectSelectorProps {
  currentProjectId: string | null;
  currentProjectName: string;
  getData: () => HydroProjectSave;
  onLoadProject: (id: string, name: string, data: HydroProjectSave) => void;
  onProjectChange: (id: string, name: string) => void;
}

export const ProjectSelector = ({
  currentProjectId, currentProjectName,
  getData, onLoadProject, onProjectChange,
}: ProjectSelectorProps) => {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [showOpen, setShowOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  const refreshProjects = useCallback(async () => {
    const list = await listAllProjects();
    setProjects(list);
  }, []);

  useEffect(() => { refreshProjects(); }, [refreshProjects]);

  const handleSaveAs = async () => {
    if (!newName.trim()) { toast.error("Digite um nome para o projeto."); return; }
    setLoading(true);
    try {
      const data = getData();
      const id = await saveProjectAs(newName.trim(), data);
      onProjectChange(id, newName.trim());
      setShowSaveAs(false);
      setNewName("");
      await refreshProjects();
      toast.success(`Projeto "${newName.trim()}" salvo!`);
    } finally { setLoading(false); }
  };

  const handleSaveCurrent = async () => {
    if (!currentProjectId) {
      setShowSaveAs(true);
      return;
    }
    const data = getData();
    data.projectName = currentProjectName;
    await syncProjectToSupabase(data, currentProjectId).catch(() => {});
    toast.success(`"${currentProjectName}" salvo na nuvem`);
  };

  const handleOpen = async (project: ProjectListItem) => {
    setLoading(true);
    try {
      const result = await loadProjectFromSupabase(project.id);
      if (result) {
        onLoadProject(result.id, project.nome, result.data);
        toast.success(`Projeto "${project.nome}" carregado`);
      } else {
        toast.error("Projeto não encontrado no servidor.");
      }
      setShowOpen(false);
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Excluir o projeto "${nome}"?`)) return;
    await deleteProject(id);
    await refreshProjects();
    toast.success(`"${nome}" excluído`);
  };

  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch { return d; }
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="flex items-center gap-1 py-1">
        <ChevronDown className="h-3 w-3" />
        {currentProjectName || "Sem nome"}
      </Badge>

      <Button variant="outline" size="sm" onClick={handleSaveCurrent} title="Salvar projeto atual">
        <Save className="h-4 w-4 mr-1" /> Salvar
      </Button>

      {/* Save As */}
      <Dialog open={showSaveAs} onOpenChange={setShowSaveAs}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" title="Salvar como novo projeto">
            <Plus className="h-4 w-4 mr-1" /> Salvar Como...
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Salvar Projeto Como...</DialogTitle></DialogHeader>
          <div className="flex gap-2">
            <Input placeholder="Nome do projeto" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSaveAs()} autoFocus />
            <Button onClick={handleSaveAs} disabled={loading}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Open Project */}
      <Dialog open={showOpen} onOpenChange={v => { setShowOpen(v); if (v) refreshProjects(); }}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" title="Abrir projeto salvo">
            <FolderOpen className="h-4 w-4 mr-1" /> Abrir
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Projetos Salvos</DialogTitle></DialogHeader>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Nenhum projeto salvo.</p>
          ) : (
            <div className="max-h-80 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Pontos</TableHead>
                    <TableHead>Trechos</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map(p => (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleOpen(p)}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(p.updatedAt)}</TableCell>
                      <TableCell>{p.pontosCount}</TableCell>
                      <TableCell>{p.trechosCount}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); handleDelete(p.id, p.nome); }}>
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
