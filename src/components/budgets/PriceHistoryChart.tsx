import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export const PriceHistoryChart = () => {
  const [selectedMaterial, setSelectedMaterial] = useState<string>("");

  const { data: materials } = useQuery({
    queryKey: ['materials-for-chart'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  const { data: priceHistory, isLoading } = useQuery({
    queryKey: ['price-history', selectedMaterial],
    queryFn: async () => {
      if (!selectedMaterial) return [];
      
      const { data, error } = await supabase
        .from('price_history')
        .select('*, materials(name)')
        .eq('material_id', selectedMaterial)
        .order('changed_at');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedMaterial
  });

  const chartData = priceHistory?.map(item => ({
    date: format(new Date(item.changed_at), 'dd/MM/yyyy', { locale: ptBR }),
    precoAntigo: item.old_price,
    precoNovo: item.new_price
  })) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução de Preços</CardTitle>
        <CardDescription>
          Acompanhe o histórico de alterações de preço dos materiais
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um material" />
          </SelectTrigger>
          <SelectContent>
            {materials?.map((material) => (
              <SelectItem key={material.id} value={material.id}>
                {material.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => `R$ ${value.toFixed(2)}`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="precoAntigo" 
                stroke="hsl(var(--muted-foreground))" 
                name="Preço Anterior"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="precoNovo" 
                stroke="hsl(var(--primary))" 
                name="Preço Novo"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : selectedMaterial ? (
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-muted-foreground">Nenhum histórico de preço encontrado</p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-muted-foreground">Selecione um material para ver seu histórico</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
