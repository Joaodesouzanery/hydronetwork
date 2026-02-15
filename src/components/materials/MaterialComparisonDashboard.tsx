import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { AlertCircle, Package, TrendingUp, TrendingDown } from "lucide-react";

interface MaterialComparisonDashboardProps {
  projectId: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--destructive))'];

export const MaterialComparisonDashboard = ({ projectId }: MaterialComparisonDashboardProps) => {
  const [period, setPeriod] = useState<"week" | "month" | "quarter">("month");
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      loadComparisonData();
    }
  }, [projectId, period]);

  const getDateFilter = () => {
    const end = new Date();
    let start = new Date();

    switch (period) {
      case 'week':
        start.setDate(end.getDate() - 7);
        break;
      case 'month':
        start.setMonth(end.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(end.getMonth() - 3);
        break;
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  const loadComparisonData = async () => {
    setIsLoading(true);
    try {
      const dateFilter = getDateFilter();

      // Buscar pedidos de material
      const { data: requests } = await supabase
        .from('material_requests')
        .select('*')
        .eq('project_id', projectId)
        .gte('request_date', dateFilter.start)
        .lte('request_date', dateFilter.end);

      // Buscar controle de material
      const { data: control } = await supabase
        .from('material_control')
        .select('*')
        .eq('project_id', projectId)
        .gte('usage_date', dateFilter.start)
        .lte('usage_date', dateFilter.end);

      // Processar dados para comparação
      const materialMap = new Map();

      requests?.forEach(req => {
        const key = req.material_name;
        const existing = materialMap.get(key) || { 
          material: key, 
          solicitado: 0, 
          usado: 0,
          unit: req.unit 
        };
        existing.solicitado += Number(req.quantity);
        materialMap.set(key, existing);
      });

      control?.forEach(ctrl => {
        const key = ctrl.material_name;
        const existing = materialMap.get(key) || { 
          material: key, 
          solicitado: 0, 
          usado: 0,
          unit: ctrl.unit 
        };
        existing.usado += Number(ctrl.quantity_used);
        materialMap.set(key, existing);
      });

      const comparison = Array.from(materialMap.values()).map(item => ({
        ...item,
        diferenca: item.solicitado - item.usado,
        percentualUso: item.solicitado > 0 ? (item.usado / item.solicitado) * 100 : 0
      }));

      setComparisonData(comparison);
      setFilteredData(comparison);
      setSelectedMaterials([]);
    } catch (error) {
      console.error("Erro ao carregar dados de comparação:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTotalStats = () => {
    const dataToUse = selectedMaterials.length > 0 ? filteredData : comparisonData;
    const totalSolicitado = dataToUse.reduce((sum, item) => sum + item.solicitado, 0);
    const totalUsado = dataToUse.reduce((sum, item) => sum + item.usado, 0);
    const eficiencia = totalSolicitado > 0 ? (totalUsado / totalSolicitado) * 100 : 0;

    return { totalSolicitado, totalUsado, eficiencia };
  };

  const toggleMaterialSelection = (materialName: string) => {
    let newSelection: string[];
    if (selectedMaterials.includes(materialName)) {
      newSelection = selectedMaterials.filter(m => m !== materialName);
    } else {
      newSelection = [...selectedMaterials, materialName];
    }
    setSelectedMaterials(newSelection);
    
    if (newSelection.length > 0) {
      setFilteredData(comparisonData.filter(item => newSelection.includes(item.material)));
    } else {
      setFilteredData(comparisonData);
    }
  };

  const stats = getTotalStats();

  if (isLoading) {
    return <div className="text-center py-8">Carregando dados...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex-1">
          {comparisonData.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium">Filtrar materiais:</span>
              {comparisonData.map((item) => (
                <Button
                  key={item.material}
                  variant={selectedMaterials.includes(item.material) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleMaterialSelection(item.material)}
                >
                  {item.material}
                </Button>
              ))}
              {selectedMaterials.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedMaterials([]);
                    setFilteredData(comparisonData);
                  }}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          )}
        </div>
        <Select value={period} onValueChange={(value) => setPeriod(value as "week" | "month" | "quarter")}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Última Semana</SelectItem>
            <SelectItem value="month">Último Mês</SelectItem>
            <SelectItem value="quarter">Último Trimestre</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Solicitado</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSolicitado.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Soma de todos os pedidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usado</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsado.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Soma do consumo real</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eficiência</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.eficiencia > 100 ? 'text-destructive' : 'text-green-600'}`}>
              {stats.eficiencia.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.eficiencia > 100 ? 'Consumo acima do pedido' : 'Dentro do planejado'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Comparação */}
      <Card>
        <CardHeader>
          <CardTitle>Comparativo: Solicitado x Usado</CardTitle>
          <CardDescription>Análise por material</CardDescription>
        </CardHeader>
        <CardContent>
          {(selectedMaterials.length > 0 ? filteredData : comparisonData).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum dado encontrado</h3>
              <p className="text-muted-foreground">
                Não há dados de materiais para o período selecionado
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={selectedMaterials.length > 0 ? filteredData : comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="material" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="solicitado" fill="hsl(var(--primary))" name="Solicitado" />
                <Bar dataKey="usado" fill="hsl(var(--secondary))" name="Usado" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Material</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(selectedMaterials.length > 0 ? filteredData : comparisonData).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="font-semibold">{item.material}</div>
                  <div className="text-sm text-muted-foreground">
                    Solicitado: {item.solicitado.toFixed(2)} {item.unit} | 
                    Usado: {item.usado.toFixed(2)} {item.unit}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${item.diferenca < 0 ? 'text-destructive' : 'text-green-600'}`}>
                    {item.diferenca >= 0 ? '+' : ''}{item.diferenca.toFixed(2)} {item.unit}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {item.percentualUso.toFixed(1)}% utilizado
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
