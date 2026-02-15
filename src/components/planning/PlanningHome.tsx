import { Calculator, Upload, FileText, ArrowRight, FolderOpen, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getProjects, deleteProject, formatCurrency, type ProjectData } from "./planningUtils";
import { useState } from "react";

interface PlanningHomeProps {
  onNewProject: () => void;
  onOpenProject: (project: ProjectData) => void;
}

export function PlanningHome({ onNewProject, onOpenProject }: PlanningHomeProps) {
  const [projects, setProjects] = useState(getProjects());

  const handleDelete = (createdAt: string) => {
    deleteProject(createdAt);
    setProjects(getProjects());
  };

  const steps = [
    { icon: Upload, title: "1. Upload", desc: "Envie seus dados topográficos e base de custos em CSV ou Excel." },
    { icon: Calculator, title: "2. Processamento", desc: "O sistema calcula automaticamente trechos, declividades e custos." },
    { icon: FileText, title: "3. Resultados", desc: "Visualize relatórios, gráficos e exporte em Excel ou PDF." },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-2">Pré-Dimensionamento de Redes de Saneamento</h2>
        <p className="text-muted-foreground">
          Automatize o cálculo de trechos, declividades e orçamento de redes de esgoto e água
          com base em dados topográficos.
        </p>
        <Button size="lg" className="mt-6" onClick={onNewProject}>
          <FolderOpen className="h-5 w-5 mr-2" />
          Novo Projeto
        </Button>
      </div>

      {/* Como Funciona */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-center">Como Funciona</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map((step, i) => (
            <Card key={i} className="text-center">
              <CardContent className="pt-6">
                <step.icon className="h-10 w-10 mx-auto mb-3 text-primary" />
                <h4 className="font-semibold mb-1">{step.title}</h4>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Projetos Recentes */}
      {projects.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Projetos Recentes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Card key={p.createdAt} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="truncate">{p.config.nome}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); handleDelete(p.createdAt); }}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>{p.trechos.length} trechos • {p.pontos.length} pontos</p>
                    <p>{formatCurrency(p.trechos.reduce((s, t) => s + t.custo_total, 0))}</p>
                    <p>{new Date(p.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => onOpenProject(p)}>
                    <ArrowRight className="h-3.5 w-3.5 mr-1" /> Abrir
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
