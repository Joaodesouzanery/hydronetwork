import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Clock, CheckCircle2, Calendar, User } from "lucide-react";

interface OccurrenceDetailsDialogProps {
  occurrence: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: string, status: string) => void;
}

export function OccurrenceDetailsDialog({
  occurrence,
  open,
  onOpenChange,
  onStatusChange,
}: OccurrenceDetailsDialogProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      aberta: { variant: "destructive", icon: AlertCircle, label: "Aberta" },
      em_analise: { variant: "secondary", icon: Clock, label: "Em Análise" },
      resolvida: { variant: "default", icon: CheckCircle2, label: "Resolvida" },
    };

    const config = variants[status] || variants.aberta;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      erro_execucao: "Erro de Execução",
      atraso: "Atraso",
      material_inadequado: "Material Inadequado",
      falha_seguranca: "Falha de Segurança",
      reprovacao_checklist: "Reprovação de Checklist",
    };

    return labels[type] || type;
  };

  const getResponsibleTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      engenheiro: "Engenheiro",
      mestre_obras: "Mestre de Obras",
      terceirizado: "Terceirizado",
      fornecedor: "Fornecedor",
      equipe_interna: "Equipe Interna",
    };

    return labels[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da Ocorrência</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-2">
            {getStatusBadge(occurrence.status)}
            <Badge variant="outline">{getTypeLabel(occurrence.occurrence_type)}</Badge>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Descrição</h3>
            <p className="text-muted-foreground">{occurrence.description}</p>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            {occurrence.projects && (
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Projeto
                </p>
                <p className="text-sm text-muted-foreground">
                  {occurrence.projects.name}
                </p>
              </div>
            )}

            {occurrence.daily_reports && (
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data do RDO
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(occurrence.daily_reports.report_date).toLocaleDateString("pt-BR")}
                </p>
              </div>
            )}

            {occurrence.responsible_type && (
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Tipo de Responsável
                </p>
                <p className="text-sm text-muted-foreground">
                  {getResponsibleTypeLabel(occurrence.responsible_type)}
                </p>
              </div>
            )}

            {occurrence.employees && (
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Responsável
                </p>
                <p className="text-sm text-muted-foreground">
                  {occurrence.employees.name}
                </p>
              </div>
            )}

            {occurrence.correction_deadline && (
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Prazo de Correção
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(occurrence.correction_deadline).toLocaleDateString("pt-BR")}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Registrada em
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(occurrence.created_at).toLocaleDateString("pt-BR")} às{" "}
                {new Date(occurrence.created_at).toLocaleTimeString("pt-BR")}
              </p>
            </div>

            {occurrence.resolved_at && (
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Resolvida em
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(occurrence.resolved_at).toLocaleDateString("pt-BR")} às{" "}
                  {new Date(occurrence.resolved_at).toLocaleTimeString("pt-BR")}
                </p>
              </div>
            )}
          </div>

          {occurrence.resolution_notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Notas de Resolução</h3>
                <p className="text-muted-foreground">{occurrence.resolution_notes}</p>
              </div>
            </>
          )}

          {occurrence.photos_urls && occurrence.photos_urls.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Evidências</h3>
                <p className="text-sm text-muted-foreground">
                  📷 {occurrence.photos_urls.length} foto(s) anexada(s)
                </p>
              </div>
            </>
          )}

          {occurrence.status !== "resolvida" && (
            <>
              <Separator />
              <div className="flex gap-2">
                {occurrence.status === "aberta" && (
                  <Button
                    variant="secondary"
                    onClick={() => onStatusChange(occurrence.id, "em_analise")}
                  >
                    Marcar como Em Análise
                  </Button>
                )}
                {(occurrence.status === "aberta" || occurrence.status === "em_analise") && (
                  <Button
                    onClick={() => onStatusChange(occurrence.id, "resolvida")}
                  >
                    Marcar como Resolvida
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
