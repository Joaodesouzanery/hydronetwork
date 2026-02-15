import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface EditReadingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reading: any;
  onSuccess: () => void;
}

export function EditReadingDialog({
  open,
  onOpenChange,
  reading,
  onSuccess,
}: EditReadingDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    reading_date: "",
    reading_time: "",
    meter_type: "",
    meter_value: "",
    location: "",
    notes: "",
  });

  useEffect(() => {
    if (reading) {
      setFormData({
        reading_date: reading.reading_date || "",
        reading_time: reading.reading_time || "",
        meter_type: reading.meter_type || "",
        meter_value: reading.meter_value?.toString() || "",
        location: reading.location || "",
        notes: reading.notes || "",
      });
    }
  }, [reading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.meter_value || !formData.reading_date || !formData.reading_time) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      setIsLoading(true);

      const { error } = await supabase
        .from("consumption_readings")
        .update({
          reading_date: formData.reading_date,
          reading_time: formData.reading_time,
          meter_type: formData.meter_type,
          meter_value: parseFloat(formData.meter_value),
          location: formData.location || null,
          notes: formData.notes || null,
        })
        .eq("id", reading.id);

      if (error) throw error;

      toast.success("Leitura atualizada com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao atualizar leitura: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Leitura</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reading_date">Data *</Label>
              <Input
                id="reading_date"
                type="date"
                value={formData.reading_date}
                onChange={(e) =>
                  setFormData({ ...formData, reading_date: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reading_time">Horário *</Label>
              <Select
                value={formData.reading_time}
                onValueChange={(value) =>
                  setFormData({ ...formData, reading_time: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="08:00">08:00</SelectItem>
                  <SelectItem value="14:00">14:00</SelectItem>
                  <SelectItem value="18:00">18:00</SelectItem>
                  <SelectItem value="20:00">20:00</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meter_type">Tipo de Medidor *</Label>
            <Select
              value={formData.meter_type}
              onValueChange={(value) =>
                setFormData({ ...formData, meter_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="water">Água</SelectItem>
                <SelectItem value="energy">Energia</SelectItem>
                <SelectItem value="gas">Gás</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meter_value">Valor do Medidor *</Label>
            <Input
              id="meter_value"
              type="number"
              step="0.01"
              value={formData.meter_value}
              onChange={(e) =>
                setFormData({ ...formData, meter_value: e.target.value })
              }
              placeholder="Ex: 1234.56"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Local</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              placeholder="Ex: Bloco A"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Observações adicionais"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
