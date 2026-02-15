import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Trash2, ArrowLeft, CheckCircle2, Circle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

const Checklists = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showItemsDialog, setShowItemsDialog] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<any>(null);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    project_id: ""
  });

  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    checkAuth();
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadChecklists();
    }
  }, [selectedProject]);

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
    if (data) {
      setProjects(data);
      if (data.length > 0) {
        setSelectedProject(data[0].id);
      }
    }
  };

  const loadChecklists = async () => {
    if (!selectedProject) return;
    
    const { data } = await supabase
      .from('checklists')
      .select('*')
      .eq('project_id', selectedProject)
      .order('created_at', { ascending: false });
    
    if (data) setChecklists(data);
  };

  const loadChecklistItems = async (checklistId: string) => {
    const { data } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('checklist_id', checklistId)
      .order('created_at', { ascending: true });
    
    if (data) setChecklistItems(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Digite o nome da checklist");
      return;
    }

    if (!selectedProject) {
      toast.error("Selecione um projeto");
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('checklists')
        .insert([{
          name: formData.name,
          project_id: selectedProject,
          created_by_user_id: user.id
        }]);

      if (error) throw error;
      
      toast.success("Checklist criada com sucesso!");
      setFormData({ name: "", project_id: "" });
      setShowDialog(false);
      loadChecklists();
      
    } catch (error: any) {
      toast.error("Erro ao criar checklist: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.trim()) {
      toast.error("Digite a descrição do item");
      return;
    }

    if (!selectedChecklist) return;

    try {
      const { error } = await supabase
        .from('checklist_items')
        .insert([{
          checklist_id: selectedChecklist.id,
          description: newItem,
          status: 'pending'
        }]);

      if (error) throw error;
      
      toast.success("Item adicionado!");
      setNewItem("");
      loadChecklistItems(selectedChecklist.id);
      
    } catch (error: any) {
      toast.error("Erro ao adicionar item: " + error.message);
    }
  };

  const handleUpdateItemStatus = async (itemId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('checklist_items')
        .update({ status: newStatus })
        .eq('id', itemId);

      if (error) throw error;
      
      loadChecklistItems(selectedChecklist.id);
      
    } catch (error: any) {
      toast.error("Erro ao atualizar item: " + error.message);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('checklist_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      
      toast.success("Item removido!");
      loadChecklistItems(selectedChecklist.id);
      
    } catch (error: any) {
      toast.error("Erro ao remover item: " + error.message);
    }
  };

  const handleDeleteChecklist = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta checklist?")) return;

    try {
      const { error } = await supabase
        .from('checklists')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Checklist excluída com sucesso!");
      loadChecklists();
    } catch (error: any) {
      toast.error("Erro ao excluir checklist: " + error.message);
    }
  };

  const openItemsDialog = (checklist: any) => {
    setSelectedChecklist(checklist);
    loadChecklistItems(checklist.id);
    setShowItemsDialog(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'not_done':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Circle className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      done: "Feito",
      pending: "Pendente",
      not_done: "Não Feito"
    };
    return labels[status] || status;
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
              <h1 className="text-xl font-semibold">Checklists de Verificação</h1>
            </div>
            <div className="flex gap-2 items-center">
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-64">
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
              <Button onClick={() => {
                setFormData({ name: "", project_id: "" });
                setShowDialog(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Checklist
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {checklists.map(checklist => (
            <Card key={checklist.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{checklist.name}</CardTitle>
                    <CardDescription className="mt-1">
                      Criada em {new Date(checklist.created_at).toLocaleDateString('pt-BR')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => openItemsDialog(checklist)}
                    className="flex-1"
                  >
                    Ver Itens
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteChecklist(checklist.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {checklists.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma checklist cadastrada</h3>
                <p className="text-muted-foreground mb-4">Crie sua primeira checklist para começar</p>
                <Button onClick={() => setShowDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Checklist
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Dialog para criar checklist */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Checklist</DialogTitle>
            <DialogDescription>
              Crie uma nova lista de verificação para garantir qualidade e documentar inspeções
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Checklist *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Checklist de Segurança, Checklist de Concretagem..."
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Exemplos: Checklist de Segurança, Checklist de Concretagem, Checklist de Entrega de Pavimento, Checklist de Inspeção
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Criando..." : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para gerenciar itens da checklist */}
      <Dialog open={showItemsDialog} onOpenChange={setShowItemsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedChecklist?.name}</DialogTitle>
            <DialogDescription>
              Adicione e gerencie os itens desta checklist
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Adicionar novo item */}
            <div className="flex gap-2">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Digite a descrição do item..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddItem();
                  }
                }}
              />
              <Button onClick={handleAddItem}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </div>

            {/* Lista de itens */}
            <div className="space-y-2">
              {checklistItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/5">
                  {getStatusIcon(item.status)}
                  <div className="flex-1">
                    <p className="text-sm">{item.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Status: {getStatusLabel(item.status)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={item.status === 'done' ? 'default' : 'outline'}
                      onClick={() => handleUpdateItemStatus(item.id, 'done')}
                    >
                      Feito
                    </Button>
                    <Button
                      size="sm"
                      variant={item.status === 'pending' ? 'default' : 'outline'}
                      onClick={() => handleUpdateItemStatus(item.id, 'pending')}
                    >
                      Pendente
                    </Button>
                    <Button
                      size="sm"
                      variant={item.status === 'not_done' ? 'default' : 'outline'}
                      onClick={() => handleUpdateItemStatus(item.id, 'not_done')}
                    >
                      Não Feito
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {checklistItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum item adicionado ainda.</p>
                  <p className="text-sm mt-1">Use o campo acima para adicionar itens à checklist.</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowItemsDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Checklists;
