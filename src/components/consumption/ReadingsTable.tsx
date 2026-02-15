import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit } from "lucide-react";
import { EditReadingDialog } from "./EditReadingDialog";

interface ReadingsTableProps {
  readings: any[];
  onUpdate: () => void;
}

export function ReadingsTable({ readings, onUpdate }: ReadingsTableProps) {
  const [editingReading, setEditingReading] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const getMeterTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      water: "Água",
      energy: "Energia",
      gas: "Gás",
    };
    return labels[type] || type;
  };

  const handleEdit = (reading: any) => {
    setEditingReading(reading);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    onUpdate();
    setIsEditDialogOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Leituras</CardTitle>
        <CardDescription>
          Todas as leituras registradas nos últimos 30 dias
        </CardDescription>
      </CardHeader>
      <CardContent>
        {readings.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readings.map((reading) => (
                <TableRow key={reading.id}>
                  <TableCell>
                    {format(parseISO(reading.reading_date), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell>{reading.reading_time}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getMeterTypeLabel(reading.meter_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">
                    {reading.meter_value.toFixed(2)}
                  </TableCell>
                  <TableCell>{reading.location || "-"}</TableCell>
                  <TableCell>{reading.projects?.name}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(reading)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma leitura registrada
          </div>
        )}
      </CardContent>

      <EditReadingDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        reading={editingReading}
        onSuccess={handleEditSuccess}
      />
    </Card>
  );
}
