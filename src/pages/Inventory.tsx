import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Search, Package, AlertTriangle, TrendingUp, TrendingDown, Edit, Trash2, ArrowUpDown, ArrowLeft, FileDown, FileSpreadsheet, X, Filter } from "lucide-react";
import { toast } from "sonner";
import { AddInventoryItemDialog } from "@/components/inventory/AddInventoryItemDialog";
import { InventoryMovementDialog } from "@/components/inventory/InventoryMovementDialog";
import { PageTutorialButton } from "@/components/shared/PageTutorialButton";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface InventoryItem {
  id: string;
  project_id: string;
  material_name: string;
  material_code: string | null;
  category: string | null;
  unit: string | null;
  quantity_available: number;
  minimum_stock: number;
  location: string | null;
  supplier: string | null;
  unit_cost: number;
  notes: string | null;
  projects: { name: string };
}

const Inventory = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [minQuantity, setMinQuantity] = useState<string>('');
  const [maxQuantity, setMaxQuantity] = useState<string>('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [showFiltersPopover, setShowFiltersPopover] = useState(false);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  
  // Temporary filter states for the popover
  const [tempSelectedCategories, setTempSelectedCategories] = useState<string[]>([]);
  const [tempSelectedProjects, setTempSelectedProjects] = useState<string[]>([]);
  const [tempSelectedStatuses, setTempSelectedStatuses] = useState<string[]>([]);
  const [tempSelectedUnits, setTempSelectedUnits] = useState<string[]>([]);
  const [tempSelectedLocations, setTempSelectedLocations] = useState<string[]>([]);
  const [tempMinQuantity, setTempMinQuantity] = useState<string>('');
  const [tempMaxQuantity, setTempMaxQuantity] = useState<string>('');

  useEffect(() => {
    checkAuth();
    loadProjects();
  }, []);

  useEffect(() => {
    if (user) {
      loadInventory();
    }
  }, [user, selectedProject, categoryFilter]);

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
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (data) setProjects(data);
  };

  const loadInventory = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('inventory')
        .select(`
          *,
          projects (name)
        `)
        .order('material_name', { ascending: true });

      if (selectedProject !== 'all') {
        query = query.eq('project_id', selectedProject);
      }

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInventoryItems(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar almoxarifado: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', itemToDelete.id);

      if (error) throw error;

      toast.success("Material excluído com sucesso!");
      loadInventory();
      setItemToDelete(null);
    } catch (error: any) {
      toast.error("Erro ao excluir material: " + error.message);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowAddDialog(true);
  };

  const handleMovement = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowMovementDialog(true);
  };

  const filteredItems = inventoryItems.filter(item => {
    // Search filter
    const matchesSearch = item.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.material_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplier?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Low stock filter
    const isLowStock = item.quantity_available <= item.minimum_stock;
    if (showLowStockOnly && !isLowStock) return false;
    
    // Category filter
    const matchesCategory = selectedCategories.length === 0 || 
      (item.category && selectedCategories.includes(item.category));
    
    // Project filter
    const matchesProject = selectedProjects.length === 0 || 
      selectedProjects.includes(item.project_id);
    
    // Status filter
    const matchesStatus = selectedStatuses.length === 0 || 
      (selectedStatuses.includes('low') && isLowStock) ||
      (selectedStatuses.includes('normal') && !isLowStock);
    
    // Unit filter
    const matchesUnit = selectedUnits.length === 0 || 
      (item.unit && selectedUnits.includes(item.unit));
    
    // Location filter
    const matchesLocation = selectedLocations.length === 0 || 
      (item.location && selectedLocations.includes(item.location));
    
    // Quantity filter
    const matchesMinQuantity = !minQuantity || item.quantity_available >= parseFloat(minQuantity);
    const matchesMaxQuantity = !maxQuantity || item.quantity_available <= parseFloat(maxQuantity);
    
    return matchesSearch && matchesCategory && matchesProject && matchesStatus && 
           matchesUnit && matchesLocation && matchesMinQuantity && matchesMaxQuantity;
  });

  const categories = Array.from(new Set(inventoryItems.map(item => item.category).filter(Boolean)));
  const units = Array.from(new Set(inventoryItems.map(item => item.unit).filter(Boolean)));
  const locations = Array.from(new Set(inventoryItems.map(item => item.location).filter(Boolean)));
  const lowStockItems = filteredItems.filter(item => item.quantity_available <= item.minimum_stock);

  const totalValue = filteredItems.reduce((sum, item) => sum + (item.quantity_available * item.unit_cost), 0);

  const hasActiveFilters = selectedCategories.length > 0 || 
    selectedProjects.length > 0 || 
    selectedStatuses.length > 0 ||
    selectedUnits.length > 0 ||
    selectedLocations.length > 0 ||
    minQuantity !== '' ||
    maxQuantity !== '' ||
    searchTerm !== '' ||
    showLowStockOnly;

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedProjects([]);
    setSelectedStatuses([]);
    setSelectedUnits([]);
    setSelectedLocations([]);
    setMinQuantity('');
    setMaxQuantity('');
    setSearchTerm('');
    setShowLowStockOnly(false);
  };

  const applyFilters = () => {
    setSelectedCategories(tempSelectedCategories);
    setSelectedProjects(tempSelectedProjects);
    setSelectedStatuses(tempSelectedStatuses);
    setSelectedUnits(tempSelectedUnits);
    setSelectedLocations(tempSelectedLocations);
    setMinQuantity(tempMinQuantity);
    setMaxQuantity(tempMaxQuantity);
    setShowFiltersPopover(false);
  };

  const clearTempFilters = () => {
    setTempSelectedCategories([]);
    setTempSelectedProjects([]);
    setTempSelectedStatuses([]);
    setTempSelectedUnits([]);
    setTempSelectedLocations([]);
    setTempMinQuantity('');
    setTempMaxQuantity('');
  };

  const openFiltersPopover = () => {
    setTempSelectedCategories(selectedCategories);
    setTempSelectedProjects(selectedProjects);
    setTempSelectedStatuses(selectedStatuses);
    setTempSelectedUnits(selectedUnits);
    setTempSelectedLocations(selectedLocations);
    setTempMinQuantity(minQuantity);
    setTempMaxQuantity(maxQuantity);
    setShowFiltersPopover(true);
  };

  const toggleCategory = (category: string) => {
    setTempSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleProject = (projectId: string) => {
    setTempSelectedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(p => p !== projectId)
        : [...prev, projectId]
    );
  };

  const toggleStatus = (status: string) => {
    setTempSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const toggleUnit = (unit: string) => {
    setTempSelectedUnits(prev => 
      prev.includes(unit) 
        ? prev.filter(u => u !== unit)
        : [...prev, unit]
    );
  };

  const toggleLocation = (location: string) => {
    setTempSelectedLocations(prev => 
      prev.includes(location) 
        ? prev.filter(l => l !== location)
        : [...prev, location]
    );
  };

  const selectAllCategories = () => {
    setTempSelectedCategories(categories as string[]);
  };

  const selectAllProjects = () => {
    setTempSelectedProjects(projects.map(p => p.id));
  };

  const selectAllStatuses = () => {
    setTempSelectedStatuses(['low', 'normal']);
  };

  const selectAllUnits = () => {
    setTempSelectedUnits(units as string[]);
  };

  const selectAllLocations = () => {
    setTempSelectedLocations(locations as string[]);
  };

  const exportToExcel = () => {
    const csvContent = [
      ['Código', 'Material', 'Categoria', 'Projeto', 'Quantidade', 'Unidade', 'Estoque Mínimo', 'O que Precisa Comprar', 'Localização', 'Fornecedor', 'Custo Unitário', 'Status'],
      ...filteredItems.map(item => {
        const needsToBuy = Math.max(0, item.minimum_stock - item.quantity_available);
        return [
          item.material_code || '',
          item.material_name,
          item.category || '',
          item.projects.name,
          item.quantity_available,
          item.unit || '',
          item.minimum_stock,
          needsToBuy,
          item.location || '',
          item.supplier || '',
          item.unit_cost,
          item.quantity_available <= item.minimum_stock ? 'Baixo' : 'Normal'
        ];
      })
    ];

    const csv = csvContent.map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `almoxarifado_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
    link.click();
    toast.success('Planilha exportada com sucesso!');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Relatório de Almoxarifado', 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 32);
    doc.text(`Total de Itens: ${filteredItems.length}`, 14, 38);
    doc.text(`Itens com Estoque Baixo: ${lowStockItems.length}`, 14, 44);
    doc.text(`Valor Total: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, 50);

    const tableData = filteredItems.map(item => {
      const needsToBuy = Math.max(0, item.minimum_stock - item.quantity_available);
      return [
        item.material_code || '-',
        item.material_name,
        item.category || '-',
        item.projects.name,
        item.quantity_available.toString(),
        item.minimum_stock.toString(),
        needsToBuy.toString(),
        item.unit || '-',
        item.quantity_available <= item.minimum_stock ? 'Baixo' : 'Normal'
      ];
    });

    (doc as any).autoTable({
      startY: 60,
      head: [['Código', 'Material', 'Categoria', 'Projeto', 'Qtd', 'Mín', 'Comprar', 'Un.', 'Status']],
      body: tableData,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`almoxarifado_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
    toast.success('PDF exportado com sucesso!');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="text-center">
          <Package className="w-12 h-12 mx-auto text-primary animate-pulse mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

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
              <h1 className="text-xl font-semibold">Almoxarifado</h1>
            </div>
            <div className="flex gap-2">
              <PageTutorialButton pageKey="inventory" />
              <Button variant="outline" onClick={exportToExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel
              </Button>
              <Button variant="outline" onClick={exportToPDF}>
                <FileDown className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button onClick={() => {
                setSelectedItem(null);
                setShowAddDialog(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Material
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredItems.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{lowStockItems.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Itens abaixo do estoque mínimo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categorias</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="flex gap-4 items-center flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, código ou fornecedor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <Button
                  variant={showLowStockOnly ? "default" : "outline"}
                  onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                  className="gap-2"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Estoque Baixo
                  <Badge variant={showLowStockOnly ? "secondary" : "outline"} className="ml-1">
                    {lowStockItems.length}
                  </Badge>
                </Button>

                <Popover open={showFiltersPopover} onOpenChange={setShowFiltersPopover}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2" onClick={openFiltersPopover}>
                      <Filter className="h-4 w-4" />
                      Filtros Avançados
                      {(selectedCategories.length > 0 || selectedProjects.length > 0 || selectedStatuses.length > 0 || selectedUnits.length > 0 || selectedLocations.length > 0 || minQuantity || maxQuantity) && (
                        <Badge variant="secondary" className="ml-2">
                          {[selectedCategories.length, selectedProjects.length, selectedStatuses.length, selectedUnits.length, selectedLocations.length, minQuantity ? 1 : 0, maxQuantity ? 1 : 0].filter(n => n > 0).reduce((a, b) => a + b, 0)}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[500px] max-h-[600px] overflow-y-auto" align="end">
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold mb-3">Filtros Avançados</h4>
                      </div>

                      <div className="space-y-3">
                        <Label className="font-semibold text-sm">Quantidade</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="min-qty" className="text-xs text-muted-foreground">Mínimo</Label>
                            <Input
                              id="min-qty"
                              type="number"
                              placeholder="Ex: 500"
                              value={tempMinQuantity}
                              onChange={(e) => setTempMinQuantity(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="max-qty" className="text-xs text-muted-foreground">Máximo</Label>
                            <Input
                              id="max-qty"
                              type="number"
                              placeholder="Ex: 1000"
                              value={tempMaxQuantity}
                              onChange={(e) => setTempMaxQuantity(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold text-sm">Categorias</Label>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={selectAllCategories}
                            className="h-auto p-0 text-xs"
                          >
                            Selecionar todas
                          </Button>
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                          {categories.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-2">Nenhuma categoria</p>
                          ) : (
                            categories.map((category) => (
                              <div key={category} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`cat-${category}`}
                                  checked={tempSelectedCategories.includes(category as string)}
                                  onCheckedChange={() => toggleCategory(category as string)}
                                />
                                <Label htmlFor={`cat-${category}`} className="text-sm cursor-pointer">
                                  {category}
                                </Label>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold text-sm">Unidades</Label>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={selectAllUnits}
                            className="h-auto p-0 text-xs"
                          >
                            Selecionar todas
                          </Button>
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                          {units.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-2">Nenhuma unidade</p>
                          ) : (
                            units.map((unit) => (
                              <div key={unit} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`unit-${unit}`}
                                  checked={tempSelectedUnits.includes(unit as string)}
                                  onCheckedChange={() => toggleUnit(unit as string)}
                                />
                                <Label htmlFor={`unit-${unit}`} className="text-sm cursor-pointer">
                                  {unit}
                                </Label>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold text-sm">Localizações</Label>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={selectAllLocations}
                            className="h-auto p-0 text-xs"
                          >
                            Selecionar todas
                          </Button>
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                          {locations.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-2">Nenhuma localização</p>
                          ) : (
                            locations.map((location) => (
                              <div key={location} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`loc-${location}`}
                                  checked={tempSelectedLocations.includes(location as string)}
                                  onCheckedChange={() => toggleLocation(location as string)}
                                />
                                <Label htmlFor={`loc-${location}`} className="text-sm cursor-pointer">
                                  {location}
                                </Label>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold text-sm">Projetos</Label>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={selectAllProjects}
                            className="h-auto p-0 text-xs"
                          >
                            Selecionar todos
                          </Button>
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                          {projects.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-2">Nenhum projeto</p>
                          ) : (
                            projects.map((project) => (
                              <div key={project.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`proj-${project.id}`}
                                  checked={tempSelectedProjects.includes(project.id)}
                                  onCheckedChange={() => toggleProject(project.id)}
                                />
                                <Label htmlFor={`proj-${project.id}`} className="text-sm cursor-pointer">
                                  {project.name}
                                </Label>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold text-sm">Status do Estoque</Label>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={selectAllStatuses}
                            className="h-auto p-0 text-xs"
                          >
                            Selecionar todos
                          </Button>
                        </div>
                        <div className="space-y-2 border rounded-md p-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="status-low"
                              checked={tempSelectedStatuses.includes('low')}
                              onCheckedChange={() => toggleStatus('low')}
                            />
                            <Label htmlFor="status-low" className="text-sm cursor-pointer">
                              Estoque Baixo
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="status-normal"
                              checked={tempSelectedStatuses.includes('normal')}
                              onCheckedChange={() => toggleStatus('normal')}
                            />
                            <Label htmlFor="status-normal" className="text-sm cursor-pointer">
                              Estoque Normal
                            </Label>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4 border-t">
                        <Button
                          variant="outline"
                          onClick={clearTempFilters}
                          className="flex-1"
                        >
                          Limpar Filtros
                        </Button>
                        <Button
                          onClick={applyFilters}
                          className="flex-1"
                        >
                          Aplicar Filtros
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {hasActiveFilters && (
                  <Button variant="ghost" onClick={clearAllFilters} className="gap-2">
                    <X className="h-4 w-4" />
                    Limpar Filtros
                  </Button>
                )}
              </div>

              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2">
                  {showLowStockOnly && (
                    <Badge variant="secondary" className="gap-1">
                      Filtro: Estoque Baixo
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => setShowLowStockOnly(false)}
                      />
                    </Badge>
                  )}
                  {minQuantity && (
                    <Badge variant="secondary" className="gap-1">
                      Qtd mín: {minQuantity}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => setMinQuantity('')}
                      />
                    </Badge>
                  )}
                  {maxQuantity && (
                    <Badge variant="secondary" className="gap-1">
                      Qtd máx: {maxQuantity}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => setMaxQuantity('')}
                      />
                    </Badge>
                  )}
                  {selectedCategories.map(cat => (
                    <Badge key={cat} variant="secondary" className="gap-1">
                      {cat}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => toggleCategory(cat)}
                      />
                    </Badge>
                  ))}
                  {selectedUnits.map(unit => (
                    <Badge key={unit} variant="secondary" className="gap-1">
                      {unit}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => toggleUnit(unit)}
                      />
                    </Badge>
                  ))}
                  {selectedLocations.map(loc => (
                    <Badge key={loc} variant="secondary" className="gap-1">
                      {loc}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => toggleLocation(loc)}
                      />
                    </Badge>
                  ))}
                  {selectedProjects.map(projId => {
                    const project = projects.find(p => p.id === projId);
                    return (
                      <Badge key={projId} variant="secondary" className="gap-1">
                        {project?.name}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => toggleProject(projId)}
                        />
                      </Badge>
                    );
                  })}
                  {selectedStatuses.map(status => (
                    <Badge key={status} variant="secondary" className="gap-1">
                      {status === 'low' ? 'Estoque Baixo' : 'Estoque Normal'}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => toggleStatus(status)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle>Materiais em Estoque</CardTitle>
            <CardDescription>
              Gerencie os materiais disponíveis no almoxarifado
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum material encontrado</h3>
                <p className="text-muted-foreground mb-4">
                  Comece adicionando materiais ao almoxarifado
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Material
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Estoque Mínimo</TableHead>
                      <TableHead>O que Precisa Comprar</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => {
                      const needsToBuy = Math.max(0, item.minimum_stock - item.quantity_available);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">
                            {item.material_code || '-'}
                          </TableCell>
                          <TableCell className="font-medium">{item.material_name}</TableCell>
                          <TableCell>
                            {item.category ? (
                              <Badge variant="outline">{item.category}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{item.projects.name}</TableCell>
                          <TableCell>
                            <span className={item.quantity_available <= item.minimum_stock ? 'text-destructive font-semibold' : ''}>
                              {item.quantity_available}
                            </span>
                          </TableCell>
                          <TableCell>{item.minimum_stock}</TableCell>
                          <TableCell>
                            {needsToBuy > 0 ? (
                              <span className="text-destructive font-semibold">{needsToBuy}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{item.unit || '-'}</TableCell>
                          <TableCell>{item.location || '-'}</TableCell>
                          <TableCell>
                            {item.quantity_available <= item.minimum_stock ? (
                              <Badge variant="destructive">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Baixo
                              </Badge>
                            ) : (
                              <Badge variant="default">Normal</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMovement(item)}
                                title="Movimentar estoque"
                              >
                                <ArrowUpDown className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(item)}
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setItemToDelete(item)}
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <AddInventoryItemDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        item={selectedItem}
        onSuccess={() => {
          loadInventory();
          setShowAddDialog(false);
          setSelectedItem(null);
        }}
      />

      <InventoryMovementDialog
        open={showMovementDialog}
        onOpenChange={setShowMovementDialog}
        item={selectedItem}
        onSuccess={() => {
          loadInventory();
          setShowMovementDialog(false);
          setSelectedItem(null);
        }}
      />

      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o material "{itemToDelete?.material_name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Inventory;
