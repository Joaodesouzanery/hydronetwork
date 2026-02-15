import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { BarChart3, PieChart, Table2, TrendingUp, Users, Activity, Layers } from "lucide-react";

interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddWidget: (widget: WidgetConfig) => void;
}

export interface WidgetConfig {
  widget_type: string;
  title: string;
  config: {
    chartType?: string;
    dataSource?: string;
    showLegend?: boolean;
    colorScheme?: string;
  };
  width: number;
  height: number;
}

const WIDGET_TYPES = [
  {
    id: 'kpi',
    name: 'Indicador KPI',
    description: 'Exibe um número ou percentual destacado',
    icon: TrendingUp,
    defaultSize: { width: 1, height: 1 }
  },
  {
    id: 'bar_chart',
    name: 'Gráfico de Barras',
    description: 'Comparação de valores entre categorias',
    icon: BarChart3,
    defaultSize: { width: 2, height: 2 }
  },
  {
    id: 'pie_chart',
    name: 'Gráfico de Pizza',
    description: 'Distribuição proporcional de valores',
    icon: PieChart,
    defaultSize: { width: 2, height: 2 }
  },
  {
    id: 'table',
    name: 'Tabela de Dados',
    description: 'Exibição de dados em formato tabular',
    icon: Table2,
    defaultSize: { width: 2, height: 2 }
  },
  {
    id: 'team_performance',
    name: 'Desempenho de Equipes',
    description: 'Comparativo entre equipes ou funcionários',
    icon: Users,
    defaultSize: { width: 2, height: 2 }
  },
  {
    id: 'production_trend',
    name: 'Tendência de Produção',
    description: 'Evolução da produção ao longo do tempo',
    icon: Activity,
    defaultSize: { width: 2, height: 2 }
  },
  {
    id: 'service_comparison',
    name: 'Comparativo de Serviços',
    description: 'Planejado vs Realizado por serviço',
    icon: Layers,
    defaultSize: { width: 2, height: 2 }
  }
];

const DATA_SOURCES = [
  { id: 'production', name: 'Produção' },
  { id: 'employees', name: 'Funcionários' },
  { id: 'projects', name: 'Projetos' },
  { id: 'services', name: 'Serviços' },
  { id: 'materials', name: 'Materiais' },
  { id: 'occurrences', name: 'Ocorrências' },
];

const COLOR_SCHEMES = [
  { id: 'default', name: 'Padrão' },
  { id: 'blue', name: 'Azul' },
  { id: 'green', name: 'Verde' },
  { id: 'orange', name: 'Laranja' },
  { id: 'purple', name: 'Roxo' },
];

export function AddWidgetDialog({ open, onOpenChange, onAddWidget }: AddWidgetDialogProps) {
  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [selectedType, setSelectedType] = useState<string>('');
  const [title, setTitle] = useState('');
  const [dataSource, setDataSource] = useState('production');
  const [colorScheme, setColorScheme] = useState('default');
  const [chartType, setChartType] = useState('bar');

  const handleSelectType = (typeId: string) => {
    setSelectedType(typeId);
    const widgetType = WIDGET_TYPES.find(w => w.id === typeId);
    if (widgetType) {
      setTitle(widgetType.name);
    }
    setStep('configure');
  };

  const handleAddWidget = () => {
    const widgetType = WIDGET_TYPES.find(w => w.id === selectedType);
    if (!widgetType) return;

    onAddWidget({
      widget_type: selectedType,
      title,
      config: {
        chartType: selectedType.includes('chart') ? chartType : undefined,
        dataSource,
        showLegend: true,
        colorScheme,
      },
      width: widgetType.defaultSize.width,
      height: widgetType.defaultSize.height,
    });

    // Reset state
    setStep('select');
    setSelectedType('');
    setTitle('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setStep('select');
    setSelectedType('');
    setTitle('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' ? 'Adicionar Widget' : 'Configurar Widget'}
          </DialogTitle>
        </DialogHeader>

        {step === 'select' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
            {WIDGET_TYPES.map((type) => (
              <Card
                key={type.id}
                className="p-4 cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleSelectType(type.id)}
              >
                <type.icon className="h-8 w-8 text-primary mb-2" />
                <h4 className="font-semibold text-sm">{type.name}</h4>
                <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título do Widget</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Digite o título"
              />
            </div>

            <div className="space-y-2">
              <Label>Fonte de Dados</Label>
              <Select value={dataSource} onValueChange={setDataSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_SOURCES.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedType.includes('chart') && (
              <div className="space-y-2">
                <Label>Tipo de Gráfico</Label>
                <Select value={chartType} onValueChange={setChartType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Barras</SelectItem>
                    <SelectItem value="line">Linhas</SelectItem>
                    <SelectItem value="area">Área</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Esquema de Cores</Label>
              <Select value={colorScheme} onValueChange={setColorScheme}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_SCHEMES.map((scheme) => (
                    <SelectItem key={scheme.id} value={scheme.id}>
                      {scheme.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'configure' && (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>
                Voltar
              </Button>
              <Button onClick={handleAddWidget}>
                Adicionar Widget
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}