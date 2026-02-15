import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onSuccess: () => void;
}

export const AddEmployeeDialog = ({ open, onOpenChange, projectId, onSuccess }: AddEmployeeDialogProps) => {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [selectedProject, setSelectedProject] = useState(projectId || "");
  const [selectedSite, setSelectedSite] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [constructionSites, setConstructionSites] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadConstructionSites(selectedProject);
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (data) setProjects(data);
  };

  const loadConstructionSites = async (projectId: string) => {
    const { data } = await supabase
      .from('construction_sites')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (data) setConstructionSites(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Digite o nome do funcionário");
      return;
    }

    if (!selectedProject) {
      toast.error("Selecione um projeto");
      return;
    }

    setIsLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Check quota before creating
      const { data: canCreate, error: quotaError } = await supabase
        .rpc('can_create_employee', { user_uuid: session?.user.id });

      if (quotaError) {
        toast.error("Erro ao verificar limite de funcionários");
        setIsLoading(false);
        return;
      }

      if (!canCreate) {
        toast.error("Você atingiu o limite de funcionários permitido. Entre em contato com o administrador.");
        setIsLoading(false);
        return;
      }
      
      const { error } = await supabase
        .from('employees')
        .insert([{
          name,
          role,
          department,
          phone,
          email,
          company_name: companyName,
          project_id: selectedProject,
          construction_site_id: selectedSite || null,
          created_by_user_id: session?.user.id
        }]);

      if (error) throw error;

      toast.success("Funcionário adicionado com sucesso!");
      setName("");
      setRole("");
      setDepartment("");
      setPhone("");
      setEmail("");
      setCompanyName("");
      setSelectedSite("");
      onSuccess();
      
    } catch (error: any) {
      toast.error("Erro ao adicionar funcionário: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar Funcionário</DialogTitle>
          <DialogDescription>
            Cadastre um novo funcionário para o projeto
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Função</Label>
              <Input
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Ex: Pedreiro, Eletricista..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Setor</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Ex: Construção Civil, Elétrica..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone (Opcional)</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail (Opcional)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Empresa</Label>
              <Input
                id="company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Nome da empresa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project">Projeto *</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger id="project">
                  <SelectValue placeholder="Selecione o projeto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="site">Local da Obra</Label>
              <Select 
                value={selectedSite} 
                onValueChange={setSelectedSite}
                disabled={!selectedProject}
              >
                <SelectTrigger id="site">
                  <SelectValue placeholder="Selecione o local (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum local específico</SelectItem>
                  {constructionSites.map(site => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
