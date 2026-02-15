import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, FileText } from "lucide-react";

interface PendingAction {
  id: string;
  action_type: string;
  resource_type: string;
  resource_id: string;
  resource_data: any;
  reason: string;
  status: string;
  created_at: string;
  requested_by_user_id: string;
  approvals: Array<{
    admin_user_id: string;
    approved: boolean;
    notes: string;
    created_at: string;
  }>;
}

const Approvals = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate('/dashboard');
      toast.error("Acesso negado. Apenas administradores podem acessar esta página.");
      return;
    }
    if (!roleLoading && isAdmin) {
      loadPendingActions();
    }
  }, [isAdmin, roleLoading, navigate]);

  const loadPendingActions = async () => {
    try {
      const { data, error } = await supabase
        .from("pending_actions")
        .select(`
          *,
          action_approvals(
            admin_user_id,
            approved,
            notes,
            created_at
          )
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPendingActions(data || []);
    } catch (error) {
      console.error("Error loading pending actions:", error);
      toast.error("Erro ao carregar solicitações pendentes");
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (actionId: string, approved: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Insert approval
      const { error: approvalError } = await supabase
        .from("action_approvals")
        .insert({
          pending_action_id: actionId,
          admin_user_id: user.id,
          approved: approved,
          notes: approved ? "Aprovado" : "Recusado"
        });

      if (approvalError) throw approvalError;

      // Check if we have 2 approvals
      const { data: approvals, error: countError } = await supabase
        .from("action_approvals")
        .select("*")
        .eq("pending_action_id", actionId)
        .eq("approved", true);

      if (countError) throw countError;

      // If we have 2 approvals, execute the action and update status
      if (approvals && approvals.length >= 2) {
        const action = pendingActions.find(a => a.id === actionId);
        if (action) {
          await executeAction(action);
          
          // Update status to approved
          await supabase
            .from("pending_actions")
            .update({ status: "approved" })
            .eq("id", actionId);
        }
        toast.success("Ação executada com sucesso! (2 aprovações atingidas)");
      } else if (!approved) {
        // If rejected, update status
        await supabase
          .from("pending_actions")
          .update({ status: "rejected" })
          .eq("id", actionId);
        toast.success("Solicitação recusada");
      } else {
        toast.success("Aprovação registrada. Aguardando segunda aprovação.");
      }

      loadPendingActions();
    } catch (error) {
      console.error("Error processing approval:", error);
      toast.error("Erro ao processar aprovação");
    }
  };

  const executeAction = async (action: PendingAction) => {
    try {
      if (action.action_type === "delete") {
        const { error } = await supabase
          .from(action.resource_type)
          .delete()
          .eq("id", action.resource_id);
        
        if (error) throw error;
      } else if (action.action_type === "edit") {
        const { error } = await supabase
          .from(action.resource_type)
          .update(action.resource_data)
          .eq("id", action.resource_id);
        
        if (error) throw error;
      }
    } catch (error) {
      console.error("Error executing action:", error);
      throw error;
    }
  };

  const getResourceTypeName = (type: string) => {
    const names: Record<string, string> = {
      'projects': 'Projeto',
      'daily_reports': 'RDO',
      'connection_reports': 'Relatório de Ligação',
      'inventory': 'Item do Almoxarifado',
      'material_requests': 'Pedido de Material',
      'assets_catalog': 'Ativo',
      'maintenance_qr_codes': 'QR Code'
    };
    return names[type] || type;
  };

  const getActionTypeName = (type: string) => {
    const names: Record<string, string> = {
      'delete': 'Exclusão',
      'edit': 'Edição',
      'archive': 'Arquivamento'
    };
    return names[type] || type;
  };

  const getApprovalCount = (action: PendingAction) => {
    return action.approvals?.filter(a => a.approved).length || 0;
  };

  if (roleLoading || loading) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1 p-6">
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
            </div>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Central de Aprovações</h1>
              <p className="text-muted-foreground">
                Gerencie solicitações de colaboradores que requerem aprovação de 2 administradores
              </p>
            </div>

            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pendentes ({pendingActions.length})
                </TabsTrigger>
                <TabsTrigger value="history">
                  <FileText className="h-4 w-4 mr-2" />
                  Histórico
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-4 mt-6">
                {pendingActions.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <CheckCircle2 className="h-16 w-16 text-muted-foreground mb-4" />
                      <p className="text-lg text-muted-foreground">
                        Nenhuma solicitação pendente
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  pendingActions.map((action) => (
                    <Card key={action.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-xl">
                              {getActionTypeName(action.action_type)} de {getResourceTypeName(action.resource_type)}
                            </CardTitle>
                            <CardDescription>
                              Solicitado em {new Date(action.created_at).toLocaleString('pt-BR')}
                            </CardDescription>
                          </div>
                          <Badge variant={getApprovalCount(action) >= 1 ? "default" : "secondary"}>
                            {getApprovalCount(action)}/2 Aprovações
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {action.reason && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Justificativa:</p>
                            <p className="text-sm">{action.reason}</p>
                          </div>
                        )}

                        {action.approvals && action.approvals.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">Aprovações:</p>
                            <div className="space-y-2">
                              {action.approvals.map((approval, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-sm">
                                  {approval.approved ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-500" />
                                  )}
                                  <span>
                                    {approval.approved ? 'Aprovado' : 'Recusado'} em{' '}
                                    {new Date(approval.created_at).toLocaleString('pt-BR')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button
                            onClick={() => handleApproval(action.id, true)}
                            className="flex-1"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Aprovar
                          </Button>
                          <Button
                            onClick={() => handleApproval(action.id, false)}
                            variant="destructive"
                            className="flex-1"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Recusar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="history">
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg text-muted-foreground">
                      Histórico será implementado em breve
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Approvals;
