import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Building2, User, Bell, Lock, LogOut, Download, Upload, Package, FileArchive, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportProjectAsZip, importProjectFromZip, previewZipContents, type ProjectManifest } from "@/engine/projectExport";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

const Settings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ProjectManifest | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }
      
      setUser(session.user);
      setDisplayName(session.user.user_metadata?.name || "");
      setIsLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate('/auth');
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logout realizado com sucesso!");
      navigate('/');
    } catch (error) {
      toast.error("Erro ao fazer logout");
    }
  };

  const handleExportProject = async () => {
    setIsExporting(true);
    try {
      await exportProjectAsZip();
      toast.success("Projeto exportado com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar projeto");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportProject = async (file: File) => {
    setIsImporting(true);
    try {
      const result = await importProjectFromZip(file);
      if (result.success) {
        const parts: string[] = [];
        if (result.counts.plans) parts.push(`${result.counts.plans} planos`);
        if (result.counts.rdos) parts.push(`${result.counts.rdos} RDOs`);
        if (result.counts.pontos) parts.push(`${result.counts.pontos} pontos`);
        if (result.counts.trechos) parts.push(`${result.counts.trechos} trechos`);
        if (result.counts.bdiContracts) parts.push(`${result.counts.bdiContracts} contratos BDI`);
        if (result.counts.equipment) parts.push(`${result.counts.equipment} equipamentos`);
        toast.success(`Importado: ${parts.join(", ")}`);
        setImportPreview(result.manifest);
      } else {
        toast.error(result.errors.join(". "));
      }
    } catch (error) {
      toast.error("Erro ao importar projeto");
    } finally {
      setIsImporting(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: { name: displayName }
      });

      if (error) throw error;

      toast.success("Perfil atualizado com sucesso!");
    } catch (error) {
      toast.error("Erro ao atualizar perfil");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="text-center">
          <Building2 className="w-12 h-12 mx-auto text-primary animate-pulse mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div className="flex items-center gap-2 text-primary">
                  <Building2 className="w-8 h-8" />
                  <span className="text-2xl font-bold">ConstruData</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user?.user_metadata?.name || user?.email}
                </span>
                <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sair">
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="container mx-auto px-4 py-8 flex-1">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Configurações</h1>
              <p className="text-muted-foreground">
                Gerencie suas preferências e informações da conta
              </p>
            </div>

            <div className="space-y-6">
              {/* Perfil */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    <CardTitle>Perfil</CardTitle>
                  </div>
                  <CardDescription>
                    Atualize suas informações pessoais
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Seu nome"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={user?.email || ""}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      O email não pode ser alterado
                    </p>
                  </div>
                  <Button onClick={handleUpdateProfile}>
                    Salvar Alterações
                  </Button>
                </CardContent>
              </Card>

              {/* Notificações */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    <CardTitle>Notificações</CardTitle>
                  </div>
                  <CardDescription>
                    Configure como você deseja receber notificações
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-notifications">Notificações por Email</Label>
                      <p className="text-sm text-muted-foreground">
                        Receba atualizações por email
                      </p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="push-notifications">Notificações Push</Label>
                      <p className="text-sm text-muted-foreground">
                        Receba notificações no navegador
                      </p>
                    </div>
                    <Switch
                      id="push-notifications"
                      checked={pushNotifications}
                      onCheckedChange={setPushNotifications}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Backup & Export */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    <CardTitle>Backup do Projeto</CardTitle>
                  </div>
                  <CardDescription>
                    Exporte todos os dados como um pacote ZIP ou importe de um backup anterior
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Export */}
                  <div className="flex items-start gap-4 p-4 rounded-lg border bg-muted/30">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Download className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div>
                        <h4 className="font-medium">Exportar Projeto</h4>
                        <p className="text-sm text-muted-foreground">
                          Baixa um arquivo .zip com todos os dados: planejamentos, RDOs, topografia, BDI, equipamentos e configurações.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary">Planejamentos</Badge>
                        <Badge variant="secondary">RDOs</Badge>
                        <Badge variant="secondary">Topografia</Badge>
                        <Badge variant="secondary">BDI</Badge>
                        <Badge variant="secondary">Equipamentos</Badge>
                        <Badge variant="secondary">Templates</Badge>
                      </div>
                      <Button onClick={handleExportProject} disabled={isExporting}>
                        {isExporting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Exportando...
                          </>
                        ) : (
                          <>
                            <FileArchive className="w-4 h-4 mr-2" />
                            Exportar como ZIP
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Import */}
                  <div className="flex items-start gap-4 p-4 rounded-lg border bg-muted/30">
                    <div className="p-2 rounded-lg bg-secondary/10">
                      <Upload className="w-5 h-5 text-secondary" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div>
                        <h4 className="font-medium">Importar Projeto</h4>
                        <p className="text-sm text-muted-foreground">
                          Carregue um arquivo .zip exportado anteriormente. Dados existentes com mesmo ID serão mantidos.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          disabled={isImporting}
                          onClick={() => {
                            const input = document.createElement("input");
                            input.type = "file";
                            input.accept = ".zip";
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) handleImportProject(file);
                            };
                            input.click();
                          }}
                        >
                          {isImporting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Importando...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Selecionar arquivo .zip
                            </>
                          )}
                        </Button>
                      </div>
                      {importPreview && (
                        <div className="mt-2 p-3 rounded-md border bg-card text-sm space-y-1">
                          <div className="flex items-center gap-2 text-success">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="font-medium">Importado com sucesso</span>
                          </div>
                          <p className="text-muted-foreground">
                            Exportado em: {new Date(importPreview.exportedAt).toLocaleString("pt-BR")}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {importPreview.modules.map((m) => (
                              <Badge key={m} variant="outline">{m}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Warning */}
                  <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/20">
                    <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Recomendamos exportar regularmente como backup. Os dados ficam salvos no navegador (localStorage) e no Supabase, mas um backup em arquivo garante que nada se perca.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Segurança */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    <CardTitle>Segurança</CardTitle>
                  </div>
                  <CardDescription>
                    Gerencie a segurança da sua conta
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Senha</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Altere sua senha regularmente para manter sua conta segura
                    </p>
                    <Button variant="outline">Alterar Senha</Button>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Excluir Conta</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Esta ação não pode ser desfeita
                    </p>
                    <Button variant="destructive">Excluir Conta</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Settings;
