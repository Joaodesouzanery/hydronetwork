import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Building2, Bell, Plus, Trash2, Mail, Eye, History, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { AlertHistoryDialog } from "@/components/alerts/AlertHistoryDialog";
import { PageTutorialButton } from "@/components/shared/PageTutorialButton";

interface Alert {
  id: string;
  tipo_alerta: string;
  obra_id: string | null;
  condicao: any;
  destinatarios: string[];
  ativo: boolean;
  obras?: { nome: string };
}

const Alerts = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [obras, setObras] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  
  const [newAlert, setNewAlert] = useState({
    tipo_alerta: "",
    obra_id: "",
    condicao: {},
    destinatarios: [""],
    ativo: true
  });

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setUser(session.user);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: obrasData } = await supabase
          .from('obras')
          .select('*')
          .order('created_at', { ascending: false });
      
      if (obrasData) setObras(obrasData);

      const { data: alertsData } = await supabase
        .from('alertas_config')
        .select('*, obras(nome)')
        .order('created_at', { ascending: false });
      
      if (alertsData) setAlerts(alertsData);
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    try {
      const alertPayload = {
        user_id: user.id,
        tipo_alerta: newAlert.tipo_alerta,
        obra_id: newAlert.obra_id || null,
        condicao: newAlert.condicao,
        destinatarios: newAlert.destinatarios.filter(email => email.trim() !== ""),
        ativo: newAlert.ativo
      };

      const { error } = await supabase
        .from('alertas_config')
        .insert([alertPayload]);

      if (error) throw error;

      toast.success("Alerta criado com sucesso!");
      setShowForm(false);
      setNewAlert({
        tipo_alerta: "",
        obra_id: "",
        condicao: {},
        destinatarios: [""],
        ativo: true
      });
      
      loadData();
    } catch (error: any) {
      toast.error("Erro ao criar alerta: " + error.message);
    }
  };

  const handleToggleAlert = async (alertId: string, currentStatus: boolean) => {

    try {
      const { error } = await supabase
        .from('alertas_config')
        .update({ ativo: !currentStatus })
        .eq('id', alertId);

      if (error) throw error;

      toast.success(currentStatus ? "Alerta desativado" : "Alerta ativado");
      loadData();
    } catch (error: any) {
      toast.error("Erro ao atualizar alerta");
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (!confirm("Deseja realmente excluir este alerta?")) return;

    try {
      const { error } = await supabase
        .from('alertas_config')
        .delete()
        .eq('id', alertId);

      if (error) throw error;

      toast.success("Alerta excluído com sucesso!");
      loadData();
    } catch (error: any) {
      toast.error("Erro ao excluir alerta");
    }
  };

  const addEmailField = () => {
    setNewAlert(prev => ({
      ...prev,
      destinatarios: [...prev.destinatarios, ""]
    }));
  };

  const updateEmail = (index: number, value: string) => {
    setNewAlert(prev => ({
      ...prev,
      destinatarios: prev.destinatarios.map((email, i) => i === index ? value : email)
    }));
  };

  const removeEmail = (index: number) => {
    setNewAlert(prev => ({
      ...prev,
      destinatarios: prev.destinatarios.filter((_, i) => i !== index)
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="text-center">
          <Bell className="w-12 h-12 mx-auto text-primary animate-pulse mb-4" />
          <p className="text-muted-foreground">Carregando alertas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                <Building2 className="w-6 h-6 mr-2" />
                <span className="font-bold">ConstruData</span>
              </Button>
              <h1 className="text-xl font-semibold">Alertas e Notificações</h1>
            </div>
            <div className="flex gap-2">
              <PageTutorialButton pageKey="alerts" />
              <Button variant="outline" onClick={() => setShowHistoryDialog(true)}>
                <History className="w-4 h-4 mr-2" />
                Histórico
              </Button>
              <Button onClick={() => setShowForm(!showForm)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Alerta
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {showForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Criar Novo Alerta</CardTitle>
              <CardDescription>Configure alertas automáticos para desvios de produção</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAlert} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo de Alerta *</Label>
                    <Select 
                      value={newAlert.tipo_alerta} 
                      onValueChange={(value) => setNewAlert(prev => ({ ...prev, tipo_alerta: value }))}
                      required
                    >
                      <SelectTrigger id="tipo">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="producao_baixa">Produção Abaixo da Meta</SelectItem>
                        <SelectItem value="funcionarios_ausentes">Funcionários Ausentes</SelectItem>
                        <SelectItem value="clima_adverso">Clima Adverso</SelectItem>
                        <SelectItem value="atraso_cronograma">Atraso no Cronograma</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="obra">Obra (opcional)</Label>
                    <Select 
                      value={newAlert.obra_id || "all"} 
                      onValueChange={(value) => setNewAlert(prev => ({ ...prev, obra_id: value === "all" ? "" : value }))}
                    >
                      <SelectTrigger id="obra">
                        <SelectValue placeholder="Todas as obras" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as obras</SelectItem>
                        {obras.map(obra => (
                          <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Destinatários *</Label>
                  {newAlert.destinatarios.map((email, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={email}
                        onChange={(e) => updateEmail(index, e.target.value)}
                        required
                      />
                      {newAlert.destinatarios.length > 1 && (
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon"
                          onClick={() => removeEmail(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={addEmailField}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Email
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ativo"
                      checked={newAlert.ativo}
                      onCheckedChange={(checked) => setNewAlert(prev => ({ ...prev, ativo: checked }))}
                    />
                    <Label htmlFor="ativo">Alerta ativo</Label>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      Criar Alerta
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Lista de Alertas */}
        <div className="grid grid-cols-1 gap-4">
          {alerts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">Nenhum alerta configurado</p>
                <p className="text-sm text-muted-foreground">Crie seu primeiro alerta para receber notificações automáticas</p>
              </CardContent>
            </Card>
          ) : (
            alerts.map(alert => (
              <Card key={alert.id} className={alert.ativo ? "" : "opacity-60"}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">
                          {alert.tipo_alerta === 'producao_baixa' && 'Produção Abaixo da Meta'}
                          {alert.tipo_alerta === 'funcionarios_ausentes' && 'Funcionários Ausentes'}
                          {alert.tipo_alerta === 'clima_adverso' && 'Clima Adverso'}
                          {alert.tipo_alerta === 'atraso_cronograma' && 'Atraso no Cronograma'}
                        </CardTitle>
                        <Badge variant={alert.ativo ? "default" : "secondary"}>
                          {alert.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <CardDescription>
                        {alert.obra_id && alert.obras ? `Obra: ${alert.obras.nome}` : "Todas as obras"}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Switch
                        checked={alert.ativo}
                        onCheckedChange={() => handleToggleAlert(alert.id, alert.ativo)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAlert(alert.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span>{alert.destinatarios.length} destinatário(s): {alert.destinatarios.join(', ')}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <AlertHistoryDialog
          open={showHistoryDialog}
          onOpenChange={setShowHistoryDialog}
        />
      </main>
    </div>
  );
};

export default Alerts;
