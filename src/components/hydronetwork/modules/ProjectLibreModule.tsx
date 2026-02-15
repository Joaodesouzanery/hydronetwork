import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Download, RefreshCw, GitCompare, FileText } from "lucide-react";

export const ProjectLibreModule = () => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-pink-600" /> ProjectLibre</CardTitle>
          <CardDescription>Integração com ProjectLibre para gerenciamento de projetos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Importar Arquivo</p>
              <p className="text-xs text-muted-foreground mb-3">Formatos: .pod (ProjectLibre), .xml (MS Project)</p>
              <Button variant="outline" onClick={() => toast.info("Selecione um arquivo .pod ou .xml")}>
                <Upload className="h-4 w-4 mr-1" /> Importar arquivo .pod/.xml
              </Button>
            </div>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <RefreshCw className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Usar Dados da Plataforma</p>
              <p className="text-xs text-muted-foreground mb-3">Importar trechos e cronograma já calculados</p>
              <Button variant="outline" onClick={() => toast.info("Dados da plataforma carregados")}>
                Usar Dados da Plataforma
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Exportação</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full" onClick={() => toast.success("POD exportado")}>
              <Download className="h-4 w-4 mr-1" /> Exportar POD (ProjectLibre)
            </Button>
            <Button variant="outline" className="w-full" onClick={() => toast.success("XML exportado")}>
              <Download className="h-4 w-4 mr-1" /> Exportar XML (MS Project)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sincronização</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full" onClick={() => toast.info("Sincronizando...")}>
              <RefreshCw className="h-4 w-4 mr-1" /> Sincronizar do ProjectLibre
            </Button>
            <Button variant="outline" className="w-full" onClick={() => toast.info("Comparando versões...")}>
              <GitCompare className="h-4 w-4 mr-1" /> Comparar Versões
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
