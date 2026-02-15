import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Upload, FileSpreadsheet, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ImportDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const ImportDataDialog = ({ open, onOpenChange, onSuccess }: ImportDataDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });
      
      data.push(row);
    }

    return data;
  };

  const handleImport = async () => {
    if (files.length === 0) {
      toast.error("Selecione pelo menos um arquivo");
      return;
    }

    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Usuário não autenticado");

      for (const file of files) {
        const text = await file.text();
        let data: any[] = [];

        // Parse baseado no tipo de arquivo
        if (file.name.endsWith('.csv')) {
          data = parseCSV(text);
        } else if (file.name.endsWith('.json')) {
          data = JSON.parse(text);
          if (!Array.isArray(data)) {
            data = [data];
          }
        } else {
          toast.warning(`Tipo de arquivo não suportado: ${file.name}`);
          continue;
        }

        // Processar e inserir dados
        for (const item of data) {
          // Mapear campos comuns para o formato do banco
          const projectData: any = {
            name: item.nome || item.name || item.projeto || 'Projeto Importado',
            status: item.status || 'active',
            created_by_user_id: session.user.id
          };

          // Campos opcionais
          if (item.data_inicio || item.start_date) {
            projectData.start_date = item.data_inicio || item.start_date;
          } else {
            projectData.start_date = new Date().toISOString().split('T')[0];
          }

          if (item.data_fim || item.end_date) {
            projectData.end_date = item.data_fim || item.end_date;
          }

          if (item.empresa || item.company) {
            projectData.company_id = item.empresa || item.company;
          }

          // Inserir projeto
          const { error } = await supabase
            .from('projects')
            .insert([projectData]);

          if (error) {
            console.error('Erro ao importar item:', error);
            toast.error(`Erro ao importar: ${item.nome || item.name}`);
          }
        }
      }

      toast.success(`${files.length} arquivo(s) processado(s) com sucesso!`);
      setFiles([]);
      onSuccess();
      
    } catch (error: any) {
      toast.error("Erro ao importar dados: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Dados de Projetos</DialogTitle>
          <DialogDescription>
            Importe dados de planilhas (CSV) ou arquivos JSON
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Fazer Upload</TabsTrigger>
            <TabsTrigger value="format">Formato dos Dados</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="files">Selecione os Arquivos</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    id="files"
                    type="file"
                    multiple
                    accept=".csv,.json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="files" className="cursor-pointer">
                    <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm font-medium mb-2">
                      Clique para selecionar arquivos
                    </p>
                    <p className="text-xs text-muted-foreground">
                      CSV ou JSON (múltiplos arquivos aceitos)
                    </p>
                  </label>
                </div>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <Label>Arquivos Selecionados:</Label>
                  <div className="border rounded-lg p-4 space-y-2">
                    {files.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        {file.name.endsWith('.csv') ? (
                          <FileSpreadsheet className="w-4 h-4 text-green-600" />
                        ) : (
                          <FileText className="w-4 h-4 text-blue-600" />
                        )}
                        <span>{file.name}</span>
                        <span className="text-muted-foreground ml-auto">
                          {(file.size / 1024).toFixed(2)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={isLoading || files.length === 0}>
                {isLoading ? "Importando..." : "Importar"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="format" className="space-y-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <h4 className="font-semibold">Formato CSV Esperado:</h4>
                <div className="bg-muted p-4 rounded-lg font-mono text-xs overflow-x-auto">
                  <div>nome,status,data_inicio,data_fim,empresa</div>
                  <div>Projeto A,active,2024-01-01,2024-12-31,Empresa XYZ</div>
                  <div>Projeto B,active,2024-02-01,,Empresa ABC</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Formato JSON Esperado:</h4>
                <div className="bg-muted p-4 rounded-lg font-mono text-xs overflow-x-auto">
                  <pre>{`[
  {
    "nome": "Projeto A",
    "status": "active",
    "data_inicio": "2024-01-01",
    "data_fim": "2024-12-31",
    "empresa": "Empresa XYZ"
  },
  {
    "nome": "Projeto B",
    "status": "active",
    "data_inicio": "2024-02-01"
  }
]`}</pre>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Campos Aceitos:</h4>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li><code className="bg-muted px-1">nome</code> ou <code className="bg-muted px-1">name</code> - Nome do projeto (obrigatório)</li>
                  <li><code className="bg-muted px-1">status</code> - Status do projeto (padrão: active)</li>
                  <li><code className="bg-muted px-1">data_inicio</code> ou <code className="bg-muted px-1">start_date</code> - Data de início</li>
                  <li><code className="bg-muted px-1">data_fim</code> ou <code className="bg-muted px-1">end_date</code> - Data de término</li>
                  <li><code className="bg-muted px-1">empresa</code> ou <code className="bg-muted px-1">company</code> - Nome da empresa</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
