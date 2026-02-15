import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, BookOpen } from "lucide-react";
import { PriceManagementTable } from "@/components/budgets/PriceManagementTable";
import { PriceHistoryChart } from "@/components/budgets/PriceHistoryChart";
import { MaterialImportDialog } from "@/components/materials/MaterialImportDialog";
import { TutorialDialog } from "@/components/shared/TutorialDialog";
const Prices = () => {
  const navigate = useNavigate();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const tutorialSteps = [
    {
      title: "Importe a tabela de preços",
      description: "Clique em \"Identificar novos materiais\" e envie o PDF/Excel com sua lista de preços."
    },
    {
      title: "Confirme materiais similares",
      description: "Se o sistema encontrar itens parecidos na sua base, escolha entre usar o existente ou cadastrar um novo."
    },
    {
      title: "Preencha/valide os preços",
      description: "O preço é obrigatório para novos materiais. Ajuste os valores na tabela antes de salvar."
    },
    {
      title: "Salve e acompanhe o histórico",
      description: "Após importar, gerencie preços na tabela e acompanhe variações no gráfico de histórico."
    }
  ];
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Preços</h1>
              <p className="text-muted-foreground">Gerencie os preços de materiais e serviços</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowTutorial(true)}>
              <BookOpen className="h-4 w-4 mr-2" />
              Tutorial
            </Button>
            <Button onClick={() => setShowImportDialog(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Identificar novos materiais
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <PriceManagementTable />
          <PriceHistoryChart />
        </div>
      </div>

      <MaterialImportDialog 
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
      />

      <TutorialDialog
        open={showTutorial}
        onOpenChange={setShowTutorial}
        title="Tutorial: Preços"
        steps={tutorialSteps}
      />
    </div>
  );
};

export default Prices;
