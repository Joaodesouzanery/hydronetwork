import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Upload, FileSpreadsheet, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ImportEmployeesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onSuccess: () => void;
}

export const ImportEmployeesDialog = ({ open, onOpenChange, projectId, onSuccess }: ImportEmployeesDialogProps) => {
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

      let totalImported = 0;
      let totalErrors = 0;

      for (const file of files) {
        const text = await file.text();
        let data: any[] = [];

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

        for (const item of data) {
          const employeeData: any = {
            name: item.nome || item.name || 'Funcionário',
            role: item.funcao || item.role || item.cargo || '',
            department: item.setor || item.department || item.departamento || '',
            phone: item.telefone || item.phone || '',
            email: item.email || '',
            company_name: item.empresa || item.company_name || item.company || '',
            status: item.status || 'active',
            created_by_user_id: session.user.id
          };

          if (projectId) {
            employeeData.project_id = projectId;
          } else if (item.projeto_id || item.project_id) {
            employeeData.project_id = item.projeto_id || item.project_id;
          }

          if (item.local_id || item.construction_site_id) {
            employeeData.construction_site_id = item.local_id || item.construction_site_id;
          }

          const { error } = await supabase
            .from('employees')
            .insert([employeeData]);

          if (error) {
            console.error('Erro ao importar funcionário:', error);
            totalErrors++;
          } else {
            totalImported++;
          }
        }
      }

      if (totalImported > 0) {
        toast.success(`${totalImported} funcionário(s) importado(s) com sucesso!`);
      }
      if (totalErrors > 0) {
        toast.warning(`${totalErrors} erro(s) durante a importação`);
      }
      
      setFiles([]);
      onSuccess();
      onOpenChange(false);
      
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
          <DialogTitle>Importar Funcionários</DialogTitle>
          <DialogDescription>
            Importe dados de funcionários de planilhas (CSV) ou arquivos JSON
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
                  <div>nome,funcao,setor,telefone,email,empresa,status</div>
                  <div>João Silva,Pedreiro,Construção Civil,(11) 99999-9999,joao@email.com,Construtora ABC,active</div>
                  <div>Maria Santos,Eletricista,Elétrica,(11) 88888-8888,maria@email.com,Elétrica XYZ,active</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Formato JSON Esperado:</h4>
                <div className="bg-muted p-4 rounded-lg font-mono text-xs overflow-x-auto">
                  <pre>{`[
  {
    "nome": "João Silva",
    "funcao": "Pedreiro",
    "setor": "Construção Civil",
    "telefone": "(11) 99999-9999",
    "email": "joao@email.com",
    "empresa": "Construtora ABC",
    "status": "active"
  },
  {
    "nome": "Maria Santos",
    "funcao": "Eletricista",
    "setor": "Elétrica",
    "telefone": "(11) 88888-8888",
    "email": "maria@email.com",
    "empresa": "Elétrica XYZ"
  }
]`}</pre>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Campos Aceitos:</h4>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li><code className="bg-muted px-1">nome</code> ou <code className="bg-muted px-1">name</code> - Nome do funcionário (obrigatório)</li>
                  <li><code className="bg-muted px-1">funcao</code> ou <code className="bg-muted px-1">role</code> ou <code className="bg-muted px-1">cargo</code> - Função</li>
                  <li><code className="bg-muted px-1">setor</code> ou <code className="bg-muted px-1">department</code> ou <code className="bg-muted px-1">departamento</code> - Setor</li>
                  <li><code className="bg-muted px-1">telefone</code> ou <code className="bg-muted px-1">phone</code> - Telefone</li>
                  <li><code className="bg-muted px-1">email</code> - E-mail</li>
                  <li><code className="bg-muted px-1">empresa</code> ou <code className="bg-muted px-1">company_name</code> ou <code className="bg-muted px-1">company</code> - Empresa</li>
                  <li><code className="bg-muted px-1">status</code> - Status (padrão: active)</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
