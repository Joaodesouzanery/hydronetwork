import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface ReportConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export const ReportConfigDialog = ({ open, onOpenChange, projectId }: ReportConfigDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    frequency: "weekly",
    enabled: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email) {
      toast.error("Digite um email válido");
      return;
    }

    setIsLoading(true);
    
    try {
      // Call edge function to configure automated reports
      const { data, error } = await supabase.functions.invoke('configure-reports', {
        body: {
          projectId,
          email: formData.email,
          frequency: formData.frequency,
          enabled: formData.enabled
        }
      });

      if (error) throw error;

      toast.success("Relatórios automáticos configurados com sucesso!");
      onOpenChange(false);
      
    } catch (error: any) {
      toast.error("Erro ao configurar relatórios: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestReport = async () => {
    if (!formData.email) {
      toast.error("Digite um email primeiro");
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-production-report', {
        body: {
          projectId,
          email: formData.email,
          reportType: 'test'
        }
      });

      if (error) throw error;

      toast.success("Relatório de teste enviado! Verifique sua caixa de entrada.");
      
    } catch (error: any) {
      toast.error("Erro ao enviar relatório de teste: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar Relatórios Automáticos</DialogTitle>
          <DialogDescription>
            Configure o envio automático de relatórios diários, semanais e mensais por email
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email para Envio *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="seu@email.com"
                required
              />
              <p className="text-xs text-muted-foreground">
                Os relatórios serão enviados para este email
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequência</Label>
              <Select 
                value={formData.frequency} 
                onValueChange={(value) => setFormData({ ...formData, frequency: value })}
              >
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diário (Todo dia às 18h)</SelectItem>
                  <SelectItem value="weekly">Semanal (Toda Segunda-feira)</SelectItem>
                  <SelectItem value="monthly">Mensal (Primeiro dia do mês)</SelectItem>
                  <SelectItem value="all">Todos (Diário, Semanal e Mensal)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">Ativar Relatórios Automáticos</Label>
                <p className="text-xs text-muted-foreground">
                  Receba relatórios automaticamente
                </p>
              </div>
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
            </div>

            <div className="border-t pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleTestReport}
                disabled={isLoading}
                className="w-full"
              >
                Enviar Relatório de Teste
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Envie um relatório de teste para verificar se está funcionando
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : "Salvar Configuração"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};