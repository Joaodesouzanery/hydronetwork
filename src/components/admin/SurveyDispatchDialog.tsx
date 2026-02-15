import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Users } from "lucide-react";

interface SurveyDispatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserWithRole {
  id: string;
  email: string;
  role?: string;
}

export function SurveyDispatchDialog({ open, onOpenChange }: SurveyDispatchDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectAll, setSelectAll] = useState(false);
  const queryClient = useQueryClient();

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["admin-users-for-survey"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-list-users");
      if (error) throw error;
      return (data?.users || []) as UserWithRole[];
    },
    enabled: open,
  });

  const { data: pendingDispatches = [] } = useQuery({
    queryKey: ["pending-dispatches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_dispatches")
        .select("user_id")
        .is("responded_at", null)
        .eq("is_dismissed", false);
      if (error) throw error;
      return data.map(d => d.user_id);
    },
    enabled: open,
  });

  const dispatchMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const dispatches = userIds.map(userId => ({
        user_id: userId,
        dispatched_by: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      }));

      const { error } = await supabase
        .from("survey_dispatches")
        .insert(dispatches);

      if (error) throw error;
      return userIds.length;
    },
    onSuccess: (count) => {
      toast.success(`Pesquisa disparada para ${count} usuário(s)!`);
      queryClient.invalidateQueries({ queryKey: ["pending-dispatches"] });
      setSelectedUsers([]);
      setSelectAll(false);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Erro ao disparar pesquisa: ${error.message}`);
    },
  });

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableUsers = filteredUsers.filter(
    user => !pendingDispatches.includes(user.id)
  );

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedUsers(availableUsers.map(u => u.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleUserToggle = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
      setSelectAll(false);
    }
  };

  const handleDispatch = () => {
    if (selectedUsers.length === 0) {
      toast.error("Selecione pelo menos um usuário");
      return;
    }
    dispatchMutation.mutate(selectedUsers);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Disparar Pesquisa de Satisfação
          </DialogTitle>
          <DialogDescription>
            Selecione os usuários que devem receber a pesquisa de satisfação
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Buscar por email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
            <Checkbox
              id="select-all"
              checked={selectAll}
              onCheckedChange={handleSelectAll}
            />
            <Label htmlFor="select-all" className="flex items-center gap-2 cursor-pointer">
              <Users className="h-4 w-4" />
              Selecionar todos ({availableUsers.length} disponíveis)
            </Label>
          </div>

          {loadingUsers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <ScrollArea className="h-[300px] border rounded-lg p-2">
              <div className="space-y-2">
                {filteredUsers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum usuário encontrado
                  </p>
                ) : (
                  filteredUsers.map((user) => {
                    const hasPending = pendingDispatches.includes(user.id);
                    return (
                      <div
                        key={user.id}
                        className={`flex items-center gap-2 p-2 rounded-lg ${
                          hasPending ? "bg-muted opacity-60" : "hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          id={user.id}
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={(checked) => 
                            handleUserToggle(user.id, checked as boolean)
                          }
                          disabled={hasPending}
                        />
                        <Label
                          htmlFor={user.id}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          <span>{user.email}</span>
                          {hasPending && (
                            <span className="ml-2 text-xs text-amber-600">
                              (pesquisa pendente)
                            </span>
                          )}
                        </Label>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          )}

          <div className="text-sm text-muted-foreground">
            {selectedUsers.length} usuário(s) selecionado(s)
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleDispatch}
            disabled={selectedUsers.length === 0 || dispatchMutation.isPending}
          >
            {dispatchMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Disparar Pesquisa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
