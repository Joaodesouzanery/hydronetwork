import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Edit, Trash2, Upload, MapPin, Search, X, HelpCircle, ArrowLeft, Clock, Download } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImportDataDialog } from "@/components/projects/ImportDataDialog";
import { TutorialDialog } from "@/components/shared/TutorialDialog";
import { PageTutorialButton } from "@/components/shared/PageTutorialButton";

const Projects = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    company_id: "",
    start_date: new Date().toISOString().split('T')[0],
    end_date: "",
    status: "active",
    address: "",
    latitude: null as number | null,
    longitude: null as number | null,
    total_budget: "",
    team_members: ""
  });

  const [serviceFronts, setServiceFronts] = useState<string[]>([]);
  const [constructionSites, setConstructionSites] = useState<string[]>([]);
  const [newServiceFront, setNewServiceFront] = useState("");
  const [newConstructionSite, setNewConstructionSite] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    checkAuth();
    loadProjects();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setUser(session.user);
  };

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setProjects(data);
  };

  const handleGeocoding = async () => {
    if (!formData.address.trim()) {
      toast.error("Digite um endereço primeiro");
      return;
    }

    setIsGeocoding(true);
    try {
      // Using Nominatim (OpenStreetMap) for free geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(formData.address)}&format=json&limit=1`,
        {
          headers: {
            'User-Agent': 'ConstruData/1.0'
          }
        }
      );
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const location = data[0];
        setFormData({
          ...formData,
          latitude: parseFloat(location.lat),
          longitude: parseFloat(location.lon)
        });
        toast.success("Localização encontrada!");
      } else {
        toast.error("Endereço não encontrado. Tente ser mais específico.");
      }
    } catch (error) {
      toast.error("Erro ao buscar localização");
    } finally {
      setIsGeocoding(false);
    }
  };

  const addServiceFront = () => {
    if (newServiceFront.trim() && !serviceFronts.includes(newServiceFront.trim())) {
      setServiceFronts([...serviceFronts, newServiceFront.trim()]);
      setNewServiceFront("");
    }
  };

  const removeServiceFront = (index: number) => {
    setServiceFronts(serviceFronts.filter((_, i) => i !== index));
  };

  const addConstructionSite = () => {
    if (newConstructionSite.trim() && !constructionSites.includes(newConstructionSite.trim())) {
      setConstructionSites([...constructionSites, newConstructionSite.trim()]);
      setNewConstructionSite("");
    }
  };

  const removeConstructionSite = (index: number) => {
    setConstructionSites(constructionSites.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Digite o nome do projeto");
      return;
    }

    // Check quota if creating new project
    if (!editingProject && user) {
      const { data: canCreate, error: quotaError } = await supabase
        .rpc('can_create_project', { user_uuid: user.id });

      if (quotaError) {
        toast.error("Erro ao verificar limite de projetos");
        return;
      }

      if (!canCreate) {
        toast.error("Você atingiu o limite de projetos permitido. Entre em contato com o administrador.");
        return;
      }
    }

    // Validar UUID do company_id se foi preenchido
    const isValidUUID = (str: string) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    const companyIdValue = formData.company_id.trim() 
      ? (isValidUUID(formData.company_id.trim()) ? formData.company_id.trim() : null)
      : null;

    setIsLoading(true);
    
    try {
      let projectId = editingProject?.id;

      if (editingProject) {
        const { error } = await supabase
          .from('projects')
          .update({
            name: formData.name,
            company_id: companyIdValue,
            start_date: formData.start_date,
            end_date: formData.end_date || null,
            status: formData.status,
            address: formData.address || null,
            latitude: formData.latitude,
            longitude: formData.longitude,
            total_budget: formData.total_budget ? parseFloat(formData.total_budget) : null,
            team_members: formData.team_members || null
          })
          .eq('id', editingProject.id);

        if (error) throw error;
        toast.success("Projeto atualizado com sucesso!");
      } else {
        const { data: newProject, error } = await supabase
          .from('projects')
          .insert([{
            name: formData.name,
            company_id: companyIdValue,
            start_date: formData.start_date,
            end_date: formData.end_date || null,
            status: formData.status,
            address: formData.address || null,
            latitude: formData.latitude,
            longitude: formData.longitude,
            total_budget: formData.total_budget ? parseFloat(formData.total_budget) : null,
            team_members: formData.team_members || null,
            created_by_user_id: user.id
          }])
          .select()
          .single();

        if (error) throw error;
        projectId = newProject.id;
        toast.success("Projeto criado com sucesso!");
      }

      // Insert service fronts
      if (serviceFronts.length > 0 && projectId) {
        const serviceFrontsData = serviceFronts.map(name => ({
          name,
          project_id: projectId,
          created_by_user_id: user.id
        }));

        const { error: sfError } = await supabase
          .from('service_fronts')
          .insert(serviceFrontsData);

        if (sfError) {
          console.error("Erro ao criar frentes de serviço:", sfError);
          toast.error("Erro ao criar frentes de serviço");
        }
      }

      // Insert construction sites
      if (constructionSites.length > 0 && projectId) {
        const sitesData = constructionSites.map(name => ({
          name,
          project_id: projectId,
          created_by_user_id: user.id
        }));

        const { error: csError } = await supabase
          .from('construction_sites')
          .insert(sitesData);

        if (csError) {
          console.error("Erro ao criar locais da obra:", csError);
          toast.error("Erro ao criar locais da obra");
        }
      }

      setFormData({
        name: "",
        company_id: "",
        start_date: new Date().toISOString().split('T')[0],
        end_date: "",
        status: "active",
        address: "",
        latitude: null,
        longitude: null,
        total_budget: "",
        team_members: ""
      });
      setServiceFronts([]);
      setConstructionSites([]);
      setEditingProject(null);
      setShowDialog(false);
      loadProjects();
      
    } catch (error: any) {
      toast.error("Erro ao salvar projeto: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (project: any) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      company_id: project.company_id || "",
      start_date: project.start_date,
      end_date: project.end_date || "",
      status: project.status,
      address: project.address || "",
      latitude: project.latitude || null,
      longitude: project.longitude || null,
      total_budget: project.total_budget?.toString() || "",
      team_members: project.team_members || ""
    });
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este projeto?")) return;

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Projeto excluído com sucesso!");
      loadProjects();
    } catch (error: any) {
      toast.error("Erro ao excluir projeto: " + error.message);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: "Ativo",
      paused: "Pausado",
      completed: "Concluído"
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      paused: "bg-yellow-100 text-yellow-800",
      completed: "bg-gray-100 text-gray-800"
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                <Building2 className="w-6 h-6 mr-2" />
                <span className="font-bold">ConstruData</span>
              </Button>
              <h1 className="text-xl font-semibold">Gerenciar Projetos</h1>
            </div>
            <div className="flex gap-2">
              <PageTutorialButton pageKey="projects" />
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Importar Dados
              </Button>
              <Button onClick={() => {
                setEditingProject(null);
                setFormData({
                  name: "",
                  company_id: "",
                  start_date: new Date().toISOString().split('T')[0],
                  end_date: "",
                  status: "active",
                  address: "",
                  latitude: null,
                  longitude: null,
                  total_budget: "",
                  team_members: ""
                });
                setServiceFronts([]);
                setConstructionSites([]);
                setShowDialog(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Projeto
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(project => (
            <Card key={project.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <CardDescription className="mt-1">
                      Início: {new Date(project.start_date).toLocaleDateString('pt-BR')}
                    </CardDescription>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                    {getStatusLabel(project.status)}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                  {project.end_date ? (
                    <CardDescription className="mt-1">
                      Término: {new Date(project.end_date).toLocaleDateString('pt-BR')}
                    </CardDescription>
                  ) : (
                    <CardDescription className="mt-1">
                      Status: Em andamento
                    </CardDescription>
                  )}
                <div className="flex flex-col gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => navigate(`/projects/${project.id}/history`)}
                    className="w-full"
                  >
                    <Clock className="w-4 h-4 mr-1" />
                    Histórico da Obra
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(project)}
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(project.id)}
                      className="flex-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {projects.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum projeto cadastrado</h3>
                <p className="text-muted-foreground mb-4">Crie seu primeiro projeto para começar</p>
                <Button onClick={() => setShowDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Projeto
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProject ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
            <DialogDescription>
              {editingProject ? "Atualize as informações do projeto" : "Crie um novo projeto de engenharia"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Projeto *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Construção Edifício Residencial"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_id">ID da Empresa (Opcional)</Label>
                <Input
                  id="company_id"
                  value={formData.company_id}
                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                  placeholder="Deixe em branco se não tiver"
                />
                <p className="text-xs text-muted-foreground">
                  Este campo é opcional e pode ser deixado em branco
                </p>
              </div>

              {/* Localização */}
              <div className="space-y-2">
                <Label htmlFor="address">Localização da Obra</Label>
                <div className="flex gap-2">
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Digite o endereço completo"
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleGeocoding}
                    disabled={isGeocoding}
                  >
                    {isGeocoding ? (
                      "Buscando..."
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Buscar
                      </>
                    )}
                  </Button>
                </div>
                {formData.latitude && formData.longitude && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3" />
                    <span>
                      Localização: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                    </span>
                  </div>
                )}
              </div>

              {/* Frentes de Serviço */}
              <div className="space-y-2">
                <Label>Frentes de Serviço</Label>
                <div className="flex gap-2">
                  <Input
                    value={newServiceFront}
                    onChange={(e) => setNewServiceFront(e.target.value)}
                    placeholder="Ex: Fundação, Estrutura, Acabamento"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addServiceFront();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addServiceFront}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {serviceFronts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {serviceFronts.map((front, index) => (
                      <div key={index} className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm">
                        <span>{front}</span>
                        <button
                          type="button"
                          onClick={() => removeServiceFront(index)}
                          className="hover:bg-primary/20 rounded p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Locais da Obra */}
              <div className="space-y-2">
                <Label>Locais da Obra</Label>
                <div className="flex gap-2">
                  <Input
                    value={newConstructionSite}
                    onChange={(e) => setNewConstructionSite(e.target.value)}
                    placeholder="Ex: Bloco A, Bloco B, Área Externa"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addConstructionSite();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addConstructionSite}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {constructionSites.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {constructionSites.map((site, index) => (
                      <div key={index} className="flex items-center gap-1 bg-secondary/10 text-secondary px-2 py-1 rounded-md text-sm">
                        <span>{site}</span>
                        <button
                          type="button"
                          onClick={() => removeConstructionSite(index)}
                          className="hover:bg-secondary/20 rounded p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Data de Início *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">Data de Término</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="em-andamento"
                        checked={!formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.checked ? '' : new Date().toISOString().split('T')[0] })}
                        className="rounded border-input"
                      />
                      <Label htmlFor="em-andamento" className="font-normal cursor-pointer">Em andamento</Label>
                    </div>
                    {formData.end_date && (
                      <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="total_budget">Orçamento Total (R$)</Label>
                  <Input
                    id="total_budget"
                    type="number"
                    step="0.01"
                    value={formData.total_budget}
                    onChange={(e) => setFormData({ ...formData, total_budget: e.target.value })}
                    placeholder="Ex: 500000.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team_members">Equipe Envolvida</Label>
                  <Input
                    id="team_members"
                    value={formData.team_members}
                    onChange={(e) => setFormData({ ...formData, team_members: e.target.value })}
                    placeholder="Ex: João, Maria, Pedro"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="paused">Pausado</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setShowDialog(false);
                setEditingProject(null);
                setServiceFronts([]);
                setConstructionSites([]);
              }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvando..." : editingProject ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ImportDataDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onSuccess={loadProjects}
      />
    </div>
  );
};

export default Projects;