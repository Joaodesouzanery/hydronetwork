import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Upload, Download, Edit, ArrowLeft, History, BarChart3, FileSpreadsheet, Sparkles, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { AddMaterialDialog } from "@/components/materials/AddMaterialDialog";
import { EditMaterialDialog } from "@/components/materials/EditMaterialDialog";
import { MaterialsTable } from "@/components/materials/MaterialsTable";
import { EditableMaterialsTable } from "@/components/materials/EditableMaterialsTable";
import { MaterialFilters } from "@/components/materials/MaterialFilters";
import { SpreadsheetUploadDialog } from "@/components/materials/SpreadsheetUploadDialog";
import { KeywordsManagementDialog } from "@/components/materials/KeywordsManagementDialog";
import { BulkEditDialog } from "@/components/materials/BulkEditDialog";
import { PriceHistoryDialog } from "@/components/materials/PriceHistoryDialog";
import { IntelligentSpreadsheetDialog } from "@/components/materials/IntelligentSpreadsheetDialog";
import { DuplicateMaterialsReport } from "@/components/materials/DuplicateMaterialsReport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageTutorialButton } from "@/components/shared/PageTutorialButton";

const Materials = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isKeywordsDialogOpen, setIsKeywordsDialogOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isPriceHistoryOpen, setIsPriceHistoryOpen] = useState(false);
  const [isIntelligentSpreadsheetOpen, setIsIntelligentSpreadsheetOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    brands: [] as string[],
    colors: [] as string[],
    minPrice: "",
    maxPrice: "",
    stockStatus: [] as string[]
  });

  const { data: materials, isLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Buscar dados do material antes de deletar
      const { data: material } = await supabase
        .from('materials')
        .select('*')
        .eq('id', id)
        .single();
      
      // Deletar o material
      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      return material;
    },
    onSuccess: (deletedMaterial) => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      
      const undoMaterial = async () => {
        try {
          const { error } = await supabase
            .from('materials')
            .insert([deletedMaterial]);
          
          if (error) throw error;
          
          queryClient.invalidateQueries({ queryKey: ['materials'] });
          toast({ title: "Material restaurado com sucesso" });
        } catch (error: any) {
          toast({
            title: "Erro ao restaurar material",
            description: error.message,
            variant: "destructive"
          });
        }
      };
      
      toast({
        title: "Material deletado com sucesso",
        action: (
          <Button variant="outline" size="sm" onClick={undoMaterial}>
            Refazer
          </Button>
        )
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao deletar material",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const filteredMaterials = materials?.filter(material => {
    const matchesSearch = !searchTerm || 
      material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesBrand = filters.brands.length === 0 || 
      (material.brand && filters.brands.includes(material.brand));

    const matchesColor = filters.colors.length === 0 || 
      (material.color && filters.colors.includes(material.color));

    const matchesPrice = 
      (!filters.minPrice || material.current_price >= parseFloat(filters.minPrice)) &&
      (!filters.maxPrice || material.current_price <= parseFloat(filters.maxPrice));

    const matchesStock = filters.stockStatus.length === 0 ||
      (filters.stockStatus.includes('low') && material.current_stock <= material.minimum_stock) ||
      (filters.stockStatus.includes('out') && material.current_stock === 0) ||
      (filters.stockStatus.includes('normal') && material.current_stock > material.minimum_stock);

    return matchesSearch && matchesBrand && matchesColor && matchesPrice && matchesStock;
  }) || [];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Precificação de Materiais e Serviços</h1>
              <p className="text-muted-foreground">Gerencie seu catálogo de materiais e serviços</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedMaterials.length > 0 && (
              <Button onClick={() => setIsBulkEditOpen(true)} variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Editar {selectedMaterials.length} selecionados
              </Button>
            )}
            <PageTutorialButton pageKey="budget-pricing" />
            <Button onClick={() => navigate('/materials/dashboard')} variant="outline">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Button onClick={() => setIsPriceHistoryOpen(true)} variant="outline">
              <History className="h-4 w-4 mr-2" />
              Histórico de Preços
            </Button>
            <Button onClick={() => setIsKeywordsDialogOpen(true)} variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Palavras-chave
            </Button>
            <Button onClick={() => setIsIntelligentSpreadsheetOpen(true)} variant="outline">
              <Sparkles className="h-4 w-4 mr-2" />
              Processar com IA
            </Button>
            <Button onClick={() => setIsUploadDialogOpen(true)} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Material
            </Button>
          </div>
        </div>
        <Tabs defaultValue="catalog" className="w-full">
          <TabsList>
            <TabsTrigger value="catalog">Catálogo</TabsTrigger>
            <TabsTrigger value="duplicates" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Duplicados
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="catalog" className="space-y-4 mt-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar materiais..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <MaterialFilters filters={filters} onFiltersChange={setFilters} materials={materials || []} />
            </div>

            <EditableMaterialsTable
              materials={filteredMaterials}
              isLoading={isLoading}
              onEdit={setEditingMaterial}
              onDelete={(id) => deleteMutation.mutate(id)}
              selectedMaterials={selectedMaterials}
              onSelectionChange={setSelectedMaterials}
            />
          </TabsContent>
          
          <TabsContent value="duplicates" className="mt-4">
            <DuplicateMaterialsReport />
          </TabsContent>
        </Tabs>

        <AddMaterialDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
        
        {editingMaterial && (
          <EditMaterialDialog
            material={editingMaterial}
            open={!!editingMaterial}
            onOpenChange={(open) => !open && setEditingMaterial(null)}
          />
        )}

        <SpreadsheetUploadDialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen} />
        <KeywordsManagementDialog open={isKeywordsDialogOpen} onOpenChange={setIsKeywordsDialogOpen} />
        <PriceHistoryDialog open={isPriceHistoryOpen} onOpenChange={setIsPriceHistoryOpen} />
        <IntelligentSpreadsheetDialog open={isIntelligentSpreadsheetOpen} onOpenChange={setIsIntelligentSpreadsheetOpen} />
        <BulkEditDialog
          open={isBulkEditOpen}
          onOpenChange={setIsBulkEditOpen}
          selectedMaterials={selectedMaterials}
          onClearSelection={() => setSelectedMaterials([])}
        />
      </div>
    </div>
  );
};

export default Materials;
