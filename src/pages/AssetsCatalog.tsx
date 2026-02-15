import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Package, Edit, Trash2, ArrowLeft, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddAssetDialog } from "@/components/facility/AddAssetDialog";
import { TutorialDialog } from "@/components/shared/TutorialDialog";

interface Asset {
  id: string;
  name: string;
  type: string;
  detailed_location?: string;
  tower?: string;
  floor?: string;
  sector?: string;
  coordinates?: string;
  main_responsible?: string;
  technical_notes?: string;
  project_id?: string;
  created_at: string;
  projects?: {
    name: string;
  };
}

const AssetsCatalog = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const tutorialSteps = [
    {
      title: "Criar um Novo Ativo",
      description: 'Clique no botão "Novo Ativo" para registrar um novo local físico ou equipamento. Preencha todos os campos necessários, incluindo nome, tipo, localização detalhada e responsável.',
    },
    {
      title: "Visualizar Ativos",
      description: "Navegue pela tabela para ver todos os ativos cadastrados. Use a busca e os filtros para encontrar ativos específicos.",
    },
    {
      title: "Editar um Ativo",
      description: "Clique no ícone de edição para atualizar as informações de um ativo. Você pode modificar qualquer campo conforme necessário.",
    },
    {
      title: "Excluir um Ativo",
      description: "Use o ícone de lixeira para remover um ativo. Será solicitada confirmação antes da exclusão definitiva.",
    },
  ];

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUser(user);
    loadAssets();
  };

  const loadAssets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("assets_catalog")
        .select(`
          *,
          projects (
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAssets(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar ativos",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!assetToDelete) return;

    try {
      const { error } = await supabase
        .from("assets_catalog")
        .delete()
        .eq("id", assetToDelete.id);

      if (error) throw error;

      toast({
        title: "Ativo excluído com sucesso",
      });

      loadAssets();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir ativo",
        description: error.message,
      });
    } finally {
      setDeleteDialogOpen(false);
      setAssetToDelete(null);
    }
  };

  const handleEdit = (asset: Asset) => {
    setSelectedAsset(asset);
    setShowAddDialog(true);
  };

  const openDeleteDialog = (asset: Asset) => {
    setAssetToDelete(asset);
    setDeleteDialogOpen(true);
  };

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.detailed_location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.main_responsible?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === "all" || asset.type === typeFilter;

    return matchesSearch && matchesType;
  });

  const assetTypes = Array.from(new Set(assets.map((a) => a.type)));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Package className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Catálogo de Ativos</h1>
              <p className="text-muted-foreground">
                Gerencie locais e equipamentos
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTutorial(true)}>
              <HelpCircle className="mr-2 h-4 w-4" />
              Tutorial
            </Button>
            <Button onClick={() => {
              setSelectedAsset(null);
              setShowAddDialog(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Ativo
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Ativos
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assets.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Tipos de Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assetTypes.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Com Responsável
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {assets.filter((a) => a.main_responsible).length}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por nome, localização ou responsável..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {assetTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Nenhum ativo encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{asset.type}</Badge>
                    </TableCell>
                    <TableCell>
                      {asset.detailed_location || "-"}
                      {asset.tower && ` - Torre ${asset.tower}`}
                      {asset.floor && ` - ${asset.floor}º andar`}
                    </TableCell>
                    <TableCell>{asset.main_responsible || "-"}</TableCell>
                    <TableCell>{asset.projects?.name || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(asset)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(asset)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AddAssetDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        asset={selectedAsset}
        onSuccess={loadAssets}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o ativo "{assetToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TutorialDialog
        open={showTutorial}
        onOpenChange={setShowTutorial}
        title="Tutorial - Catálogo de Ativos"
        steps={tutorialSteps}
      />
    </div>
  );
};

export default AssetsCatalog;
