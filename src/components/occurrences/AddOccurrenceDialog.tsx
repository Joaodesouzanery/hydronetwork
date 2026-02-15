import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface AddOccurrenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddOccurrenceDialog({ open, onOpenChange }: AddOccurrenceDialogProps) {
  const [formData, setFormData] = useState({
    project_id: "",
    occurrence_type: "",
    description: "",
    responsible_id: "",
    responsible_type: "",
    correction_deadline: "",
  });

  const queryClient = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .order("name");
      return data;
    },
    enabled: !!session,
  });

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("*")
        .order("name");
      return data;
    },
    enabled: !!session,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("occurrences").insert([
        {
          ...data,
          created_by_user_id: session?.user.id,
        },
      ]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["occurrences"] });
      toast.success("Ocorrência registrada com sucesso!");
      onOpenChange(false);
      setFormData({
        project_id: "",
        occurrence_type: "",
        description: "",
        responsible_id: "",
        responsible_type: "",
        correction_deadline: "",
      });
    },
    onError: () => {
      toast.error("Erro ao registrar ocorrência");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Ocorrência</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project_id">Projeto *</Label>
            <Select
              value={formData.project_id}
              onValueChange={(value) =>
                setFormData({ ...formData, project_id: value })
              }
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o projeto" />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="occurrence_type">Tipo de Ocorrência *</Label>
            <Select
              value={formData.occurrence_type}
              onValueChange={(value) =>
                setFormData({ ...formData, occurrence_type: value })
              }
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="erro_execucao">Erro de Execução</SelectItem>
                <SelectItem value="atraso">Atraso</SelectItem>
                <SelectItem value="material_inadequado">Material Inadequado</SelectItem>
                <SelectItem value="falha_seguranca">Falha de Segurança</SelectItem>
                <SelectItem value="reprovacao_checklist">Reprovação de Checklist</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              required
              rows={4}
              placeholder="Descreva o problema identificado..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsible_type">Tipo de Responsável</Label>
            <Select
              value={formData.responsible_type}
              onValueChange={(value) =>
                setFormData({ ...formData, responsible_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="engenheiro">Engenheiro</SelectItem>
                <SelectItem value="mestre_obras">Mestre de Obras</SelectItem>
                <SelectItem value="terceirizado">Terceirizado</SelectItem>
                <SelectItem value="fornecedor">Fornecedor</SelectItem>
                <SelectItem value="equipe_interna">Equipe Interna</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsible_id">Responsável</Label>
            <Select
              value={formData.responsible_id}
              onValueChange={(value) =>
                setFormData({ ...formData, responsible_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {employees?.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="correction_deadline">Prazo de Correção</Label>
            <Input
              id="correction_deadline"
              type="date"
              value={formData.correction_deadline}
              onChange={(e) =>
                setFormData({ ...formData, correction_deadline: e.target.value })
              }
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Registrando..." : "Registrar Ocorrência"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
