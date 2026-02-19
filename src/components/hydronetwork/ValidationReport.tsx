/**
 * Validation Report — Shows issues after import
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { ValidationIssue } from "@/engine/spatialCore";

interface ValidationReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: ValidationIssue[];
  nodeCount: number;
  edgeCount: number;
}

const SEVERITY_CONFIG = {
  error: { icon: XCircle, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30", label: "Erro" },
  warning: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", label: "Aviso" },
  info: { icon: Info, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", label: "Info" },
};

export const ValidationReport = ({ open, onOpenChange, issues, nodeCount, edgeCount }: ValidationReportProps) => {
  const errors = issues.filter(i => i.severity === "error");
  const warnings = issues.filter(i => i.severity === "warning");
  const infos = issues.filter(i => i.severity === "info");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {errors.length > 0 ? <XCircle className="h-5 w-5 text-red-600" /> :
             warnings.length > 0 ? <AlertTriangle className="h-5 w-5 text-amber-600" /> :
             <CheckCircle className="h-5 w-5 text-green-600" />}
            Relatório de Validação
          </DialogTitle>
          <DialogDescription>
            {nodeCount} nós, {edgeCount} trechos — {issues.length} problema(s) encontrado(s)
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="border-red-300 text-red-700">{errors.length} erros</Badge>
          <Badge variant="outline" className="border-amber-300 text-amber-700">{warnings.length} avisos</Badge>
          <Badge variant="outline" className="border-blue-300 text-blue-700">{infos.length} informações</Badge>
        </div>

        {issues.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
            <p className="font-medium">Nenhum problema encontrado!</p>
            <p className="text-sm text-muted-foreground">A rede importada está consistente.</p>
          </div>
        ) : (
          <div className="max-h-[50vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Severidade</TableHead>
                  <TableHead className="w-40">Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-28">Elemento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue, i) => {
                  const cfg = SEVERITY_CONFIG[issue.severity];
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={i} className={cfg.bg}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          <Icon className={`h-3 w-3 mr-1 ${cfg.color}`} />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{issue.type}</TableCell>
                      <TableCell className="text-xs">{issue.message}</TableCell>
                      <TableCell className="text-xs font-mono">{issue.elementId || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
