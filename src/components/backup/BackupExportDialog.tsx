import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Download, Mail, Calendar, FileJson, Archive } from "lucide-react";
import JSZip from "jszip";

interface BackupExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BackupExportDialog = ({ open, onOpenChange }: BackupExportDialogProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"json" | "zip">("zip");
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set([
    "projects", "materials", "budgets", "budget_items", "employees", 
    "daily_reports", "executed_services", "material_requests", "material_control"
  ]));
  
  // Auto-send config
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [autoSendEmail, setAutoSendEmail] = useState("");
  const [autoSendFrequency, setAutoSendFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const availableTables = [
    { key: "projects", label: "Projetos" },
    { key: "materials", label: "Materiais" },
    { key: "budgets", label: "Orçamentos" },
    { key: "budget_items", label: "Itens de Orçamento" },
    { key: "employees", label: "Funcionários" },
    { key: "daily_reports", label: "RDOs" },
    { key: "executed_services", label: "Serviços Executados" },
    { key: "material_requests", label: "Pedidos de Material" },
    { key: "material_control", label: "Controle de Material" },
    { key: "production_targets", label: "Metas de Produção" },
    { key: "connection_reports", label: "Relatórios de Conexão" },
    { key: "consumption_readings", label: "Leituras de Consumo" },
    { key: "checklists", label: "Checklists" },
    { key: "crm_accounts", label: "CRM - Contas" },
    { key: "crm_contacts", label: "CRM - Contatos" },
    { key: "crm_deals", label: "CRM - Negócios" },
    { key: "crm_activities", label: "CRM - Atividades" },
  ];

  const toggleTable = (tableKey: string) => {
    setSelectedTables(prev => {
      const next = new Set(prev);
      if (next.has(tableKey)) {
        next.delete(tableKey);
      } else {
        next.add(tableKey);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedTables(new Set(availableTables.map(t => t.key)));
  };

  const deselectAll = () => {
    setSelectedTables(new Set());
  };

  const exportData = async () => {
    if (selectedTables.size === 0) {
      toast.error("Selecione pelo menos uma tabela para exportar");
      return;
    }

    setIsExporting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const exportData: Record<string, any[]> = {};
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      // Export each selected table
      for (const tableName of selectedTables) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select("*");
          
          if (error) {
            console.warn(`Erro ao exportar ${tableName}:`, error.message);
            exportData[tableName] = [];
          } else {
            exportData[tableName] = data || [];
          }
        } catch (err) {
          console.warn(`Tabela ${tableName} não encontrada ou sem acesso`);
          exportData[tableName] = [];
        }
      }

      const metadata = {
        exported_at: new Date().toISOString(),
        exported_by: user.id,
        tables_count: selectedTables.size,
        format_version: "1.0",
      };

      if (exportFormat === "json") {
        // Single JSON file
        const fullExport = { metadata, data: exportData };
        const blob = new Blob([JSON.stringify(fullExport, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `construdata-backup-${timestamp}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // ZIP with individual files
        const zip = new JSZip();
        
        // Add metadata
        zip.file("_metadata.json", JSON.stringify(metadata, null, 2));
        
        // Add each table as separate JSON
        for (const [tableName, tableData] of Object.entries(exportData)) {
          zip.file(`${tableName}.json`, JSON.stringify(tableData, null, 2));
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `construdata-backup-${timestamp}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }

      // Record the backup
      await supabase.from("backups").insert({
        user_id: user.id,
        backup_type: "manual",
        status: "completed",
        metadata: {
          tables: Array.from(selectedTables),
          format: exportFormat,
          timestamp: new Date().toISOString(),
        },
      });

      toast.success("Backup exportado com sucesso!");
      onOpenChange(false);

    } catch (error: any) {
      toast.error("Erro ao exportar backup: " + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const saveAutoSendConfig = async () => {
    if (!autoSendEmail) {
      toast.error("Informe um email válido");
      return;
    }

    setIsSavingConfig(true);

    try {
      const { data, error } = await supabase.functions.invoke("configure-backup-schedule", {
        body: {
          email: autoSendEmail,
          frequency: autoSendFrequency,
          enabled: autoSendEnabled,
          tables: Array.from(selectedTables),
        },
      });

      if (error) throw error;

      toast.success(autoSendEnabled 
        ? `Backup automático configurado! Será enviado para ${autoSendEmail} ${
            autoSendFrequency === "daily" ? "diariamente" : 
            autoSendFrequency === "weekly" ? "semanalmente" : "mensalmente"
          }.`
        : "Backup automático desativado"
      );

    } catch (error: any) {
      toast.error("Erro ao salvar configuração: " + error.message);
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Exportar Backup Completo
          </DialogTitle>
          <DialogDescription>
            Exporte todos os seus dados em formato JSON ou ZIP. Configure também o envio automático por email.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Exportar Agora
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Agendar Envio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Formato de Exportação</Label>
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as "json" | "zip")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zip">
                    <div className="flex items-center gap-2">
                      <Archive className="h-4 w-4" />
                      ZIP (arquivos separados por tabela)
                    </div>
                  </SelectItem>
                  <SelectItem value="json">
                    <div className="flex items-center gap-2">
                      <FileJson className="h-4 w-4" />
                      JSON único
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tabelas para Exportar</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Selecionar Todas
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>
                    Limpar
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                {availableTables.map((table) => (
                  <label
                    key={table.key}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTables.has(table.key)}
                      onChange={() => toggleTable(table.key)}
                      className="rounded border-input"
                    />
                    <span className="text-sm">{table.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedTables.size} tabela(s) selecionada(s)
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={exportData} disabled={isExporting || selectedTables.size === 0}>
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? "Exportando..." : "Exportar Backup"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="auto-send">Ativar Envio Automático</Label>
                <p className="text-xs text-muted-foreground">
                  Receba o backup completo por email periodicamente
                </p>
              </div>
              <Switch
                id="auto-send"
                checked={autoSendEnabled}
                onCheckedChange={setAutoSendEnabled}
              />
            </div>

            {autoSendEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email para Recebimento</Label>
                  <div className="flex gap-2">
                    <Mail className="h-5 w-5 text-muted-foreground mt-2.5" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={autoSendEmail}
                      onChange={(e) => setAutoSendEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Frequência de Envio</Label>
                  <Select value={autoSendFrequency} onValueChange={(v) => setAutoSendFrequency(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diário (às 23h)</SelectItem>
                      <SelectItem value="weekly">Semanal (todo Domingo às 23h)</SelectItem>
                      <SelectItem value="monthly">Mensal (dia 1 às 23h)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Tabelas incluídas no backup automático:</h4>
                  <p className="text-sm text-muted-foreground">
                    O backup automático incluirá as mesmas tabelas selecionadas na aba "Exportar Agora".
                  </p>
                </div>
              </>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={saveAutoSendConfig} disabled={isSavingConfig}>
                <Mail className="h-4 w-4 mr-2" />
                {isSavingConfig ? "Salvando..." : "Salvar Configuração"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
