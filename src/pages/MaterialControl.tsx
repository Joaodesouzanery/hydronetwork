import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, TrendingDown, Building2, Eye, BarChart3, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { AddMaterialControlDialog } from "@/components/materials/AddMaterialControlDialog";
import { MaterialComparisonDashboard } from "@/components/materials/MaterialComparisonDashboard";
import { PageTutorialButton } from "@/components/shared/PageTutorialButton";

interface MaterialControl {
  id: string;
  usage_date: string;
  material_name: string;
  quantity_used: number;
  unit: string;
  projects: { name: string };
  service_fronts: { name: string };
}

interface MaterialSummary {
  material_name: string;
  total_used: number;
  unit: string;
}

export default function MaterialControl() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [controls, setControls] = useState<MaterialControl[]>([]);
  const [summary, setSummary] = useState<MaterialSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    checkAuth();
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchControls();
  }, [projectFilter]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setUser(session.user);
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar projetos: " + error.message);
    }
  };

  const fetchControls = async () => {
    try {
      let query = supabase
        .from("material_control")
        .select(`
          *,
          projects (name),
          service_fronts (name)
        `)
        .order("usage_date", { ascending: false });

      if (projectFilter !== "all") {
        query = query.eq("project_id", projectFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setControls(data || []);

      // Calculate summary
      const materialMap = new Map<string, { total: number; unit: string }>();
      data?.forEach((item) => {
        const key = item.material_name;
        const existing = materialMap.get(key) || { total: 0, unit: item.unit };
        existing.total += Number(item.quantity_used);
        materialMap.set(key, existing);
      });

      const summaryData = Array.from(materialMap.entries()).map(([material, data]) => ({
        material_name: material,
        total_used: data.total,
        unit: data.unit,
      }));

      setSummary(summaryData);
    } catch (error: any) {
      toast.error("Erro ao carregar controle: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };


  const filteredControls = controls.filter((ctrl) =>
    ctrl.material_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <Building2 className="w-6 h-6 mr-2" />
              <span className="font-bold">ConstruData</span>
            </Button>
            <h1 className="text-xl font-semibold">Controle de Material</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Registre e monitore o consumo de materiais</h2>
            <p className="text-muted-foreground">Acompanhe o uso de materiais</p>
          </div>
          <div className="flex gap-2">
            <PageTutorialButton pageKey="material-control" />
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar Consumo
            </Button>
          </div>
        </div>

        <Tabs defaultValue="records" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="records">Registros</TabsTrigger>
            <TabsTrigger value="comparison">
              <BarChart3 className="w-4 h-4 mr-2" />
              Comparativo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Materiais</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.length}</div>
            <p className="text-xs text-muted-foreground">Tipos diferentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registros</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{controls.length}</div>
            <p className="text-xs text-muted-foreground">Total de registros</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo de Consumo</CardTitle>
          <CardDescription>Total consumido por material</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Nenhum consumo registrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Total Consumido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.material_name}</TableCell>
                    <TableCell>
                      {item.total_used.toFixed(2)} {item.unit}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtre os registros por projeto ou material</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Projeto</label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Projetos</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar Material</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome do material..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Consumo</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Carregando...</p>
          ) : filteredControls.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Frente de Serviço</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredControls.map((control) => (
                  <TableRow key={control.id}>
                    <TableCell>{new Date(control.usage_date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-medium">{control.material_name}</TableCell>
                    <TableCell>
                      {control.quantity_used} {control.unit}
                    </TableCell>
                    <TableCell>{control.projects.name}</TableCell>
                    <TableCell>{control.service_fronts.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="comparison">
            {projectFilter !== 'all' ? (
              <MaterialComparisonDashboard projectId={projectFilter} />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BarChart3 className="w-16 h-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Selecione um projeto para visualizar o comparativo
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

      <AddMaterialControlDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={fetchControls}
      />

      </main>
    </div>
  );
}
