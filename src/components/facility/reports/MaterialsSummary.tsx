import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MaterialsSummaryProps {
  requests: any[];
  movements: any[];
}

export function MaterialsSummary({ requests, movements }: MaterialsSummaryProps) {
  const requestsByStatus = {
    pending: requests.filter((r) => r.status === "pendente").length,
    approved: requests.filter((r) => r.status === "aprovado").length,
    rejected: requests.filter((r) => r.status === "rejeitado").length,
  };

  const usedMaterials = movements
    .filter((m) => m.movement_type === "saida")
    .reduce((acc: any[], mov) => {
      const existing = acc.find((item) => item.material === mov.inventory?.material_name);
      if (existing) {
        existing.quantity += mov.quantity;
      } else {
        acc.push({
          material: mov.inventory?.material_name || "Material desconhecido",
          quantity: mov.quantity,
          unit: mov.inventory?.unit || "",
        });
      }
      return acc;
    }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Pedidos de Material</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{requestsByStatus.pending}</p>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{requestsByStatus.approved}</p>
              <p className="text-sm text-muted-foreground">Aprovados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{requestsByStatus.rejected}</p>
              <p className="text-sm text-muted-foreground">Rejeitados</p>
            </div>
          </div>

          {requests.length > 0 && (
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.slice(0, 5).map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{request.material_name}</TableCell>
                      <TableCell>
                        {request.quantity} {request.unit}
                      </TableCell>
                      <TableCell>{request.requestor_name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            request.status === "aprovado"
                              ? "default"
                              : request.status === "rejeitado"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {request.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {usedMaterials.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Materiais Utilizados</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Quantidade Total</TableHead>
                  <TableHead>Unidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usedMaterials.map((material, index) => (
                  <TableRow key={index}>
                    <TableCell>{material.material}</TableCell>
                    <TableCell className="font-mono">{material.quantity.toFixed(2)}</TableCell>
                    <TableCell>{material.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
