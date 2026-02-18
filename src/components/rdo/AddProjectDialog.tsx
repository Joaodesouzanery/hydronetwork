/**
 * Dialog to create a new project (obra) directly from the RDO page.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Plus } from "lucide-react";

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: () => void;
}

export const AddProjectDialog = ({ open, onOpenChange, onProjectCreated }: AddProjectDialogProps) => {
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("saneamento");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast.error("Nome da obra é obrigatório"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from('obras')
        .insert([{
          nome: nome.trim(),
          endereco: endereco.trim() || null,
          descricao: descricao.trim() || null,
          tipo: tipo,
          status: 'ativa',
          user_id: user.id,
        }]);

      if (error) throw error;
      toast.success("Obra cadastrada com sucesso!");
      setNome(""); setEndereco(""); setDescricao(""); setTipo("saneamento");
      onOpenChange(false);
      onProjectCreated();
    } catch (err: any) {
      toast.error("Erro ao cadastrar obra: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> Cadastrar Nova Obra
          </DialogTitle>
          <DialogDescription>
            Cadastre um novo projeto/obra para vincular aos RDOs
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome da Obra *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Rede de Esgoto - Bairro Norte" required />
          </div>
          <div>
            <Label>Endereço</Label>
            <Input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, Bairro, Cidade - UF" />
          </div>
          <div>
            <Label>Tipo de Obra</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="saneamento">Saneamento</SelectItem>
                <SelectItem value="agua">Rede de Água</SelectItem>
                <SelectItem value="esgoto">Rede de Esgoto</SelectItem>
                <SelectItem value="drenagem">Drenagem</SelectItem>
                <SelectItem value="obra_civil">Obra Civil</SelectItem>
                <SelectItem value="manutencao">Manutenção</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição detalhada da obra..." rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Cadastrar Obra"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
