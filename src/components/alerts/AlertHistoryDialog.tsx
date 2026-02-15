import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, AlertCircle } from "lucide-react";

interface AlertHistory {
  id: string;
  mensagem: string;
  enviado_em: string;
  justificativa?: string;
  justificado_por_user_id?: string;
  justificado_em?: string;
}

interface AlertHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AlertHistoryDialog({ open, onOpenChange }: AlertHistoryDialogProps) {
  const [alertHistory, setAlertHistory] = useState<AlertHistory[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAlertHistory();
    }
  }, [open]);

  const fetchAlertHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("alertas_historico")
        .select("*")
        .order("enviado_em", { ascending: false })
        .limit(50);

      if (error) throw error;
      setAlertHistory(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar histórico de alertas");
    }
  };

  const handleJustify = async (alertId: string) => {
    if (!justification.trim()) {
      toast.error("Por favor, forneça uma justificativa");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("alertas_historico")
        .update({
          justificativa: justification,
          justificado_por_user_id: user.id,
          justificado_em: new Date().toISOString()
        })
        .eq("id", alertId);

      if (error) throw error;

      toast.success("Justificativa registrada com sucesso!");
      setJustification("");
      setSelectedAlert(null);
      fetchAlertHistory();
    } catch (error: any) {
      toast.error("Erro ao registrar justificativa: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Alertas</DialogTitle>
          <DialogDescription>
            Visualize e justifique os alertas gerados pelo sistema
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {alertHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum alerta registrado
            </p>
          ) : (
            alertHistory.map((alert) => (
              <Card key={alert.id} className={alert.justificativa ? "border-green-200" : "border-orange-200"}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {alert.justificativa ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-orange-600" />
                        )}
                        <Badge variant={alert.justificativa ? "default" : "destructive"}>
                          {alert.justificativa ? "Justificado" : "Pendente"}
                        </Badge>
                      </div>
                      <p className="font-medium mb-2">{alert.mensagem}</p>
                      <p className="text-sm text-muted-foreground">
                        Enviado em: {new Date(alert.enviado_em).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>

                  {alert.justificativa ? (
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <Label className="text-sm font-medium">Justificativa:</Label>
                      <p className="text-sm mt-2">{alert.justificativa}</p>
                      {alert.justificado_em && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Justificado em: {new Date(alert.justificado_em).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4">
                      {selectedAlert === alert.id ? (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor={`justification-${alert.id}`}>
                              Justificativa *
                            </Label>
                            <Textarea
                              id={`justification-${alert.id}`}
                              placeholder="Descreva o motivo do alerta e as ações tomadas..."
                              value={justification}
                              onChange={(e) => setJustification(e.target.value)}
                              rows={4}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleJustify(alert.id)}
                              disabled={isLoading}
                            >
                              Salvar Justificativa
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedAlert(null);
                                setJustification("");
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => setSelectedAlert(alert.id)}
                        >
                          Adicionar Justificativa
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
