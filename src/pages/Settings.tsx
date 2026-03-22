import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Building2, User, Bell, Lock, LogOut, Download, Upload, Package, FileArchive, CheckCircle2, AlertTriangle, Loader2, ShieldCheck, Smartphone, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { exportProjectAsZip, importProjectFromZip, previewZipContents, type ProjectManifest } from "@/engine/projectExport";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

  // 2FA state
  const [mfaFactors, setMfaFactors] = useState<any[]>([]);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaVerifyCode, setMfaVerifyCode] = useState("");
  const [isMfaLoading, setIsMfaLoading] = useState(false);
  const [showMfaRemoveConfirm, setShowMfaRemoveConfirm] = useState(false);

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

      // Load MFA factors
      const { data: mfaData } = await supabase.auth.mfa.listFactors();
      if (mfaData?.totp) {
        setMfaFactors(mfaData.totp);
      }
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

  // Load MFA factors
  const loadMfaFactors = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setMfaFactors(data?.totp || []);
    } catch (error) {
      console.error("Error loading MFA factors:", error);
    }
  };

  // Start MFA enrollment
  const handleMfaEnroll = async () => {
    setIsMfaLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "ConstruData Authenticator",
      });

      if (error) throw error;

      setMfaQrCode(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
      setMfaFactorId(data.id);
      setShowMfaSetup(true);
    } catch (error: any) {
      toast.error(error.message || "Erro ao iniciar configuração 2FA");
    } finally {
      setIsMfaLoading(false);
    }
  };

  // Verify and activate MFA
  const handleMfaVerify = async () => {
    if (mfaVerifyCode.length !== 6) {
      toast.error("Digite o código de 6 dígitos");
      return;
    }

    setIsMfaLoading(true);
    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: mfaFactorId });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaVerifyCode,
      });

      if (verifyError) throw verifyError;

      toast.success("Autenticação em 2 fatores ativada!");
      setShowMfaSetup(false);
      setMfaVerifyCode("");
      setMfaQrCode("");
      setMfaSecret("");
      await loadMfaFactors();
    } catch (error: any) {
      toast.error(error.message || "Código inválido. Tente novamente.");
    } finally {
      setIsMfaLoading(false);
    }
  };

  // Remove MFA factor
  const handleMfaUnenroll = async () => {
    const verifiedFactor = mfaFactors.find((f: any) => f.status === "verified");
    if (!verifiedFactor) return;

    setIsMfaLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: verifiedFactor.id,
      });

      if (error) throw error;

      toast.success("Autenticação em 2 fatores desativada");
      setShowMfaRemoveConfirm(false);
      await loadMfaFactors();
    } catch (error: any) {
      toast.error(error.message || "Erro ao desativar 2FA");
    } finally {
      setIsMfaLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Building2 className="w-12 h-12 mx-auto text-primary animate-pulse mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="border-b bg-card/50 sticky top-0 z-10">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div className="flex items-center gap-2 text-primary">
                  <Building2 className="w-8 h-8" />
                  <span className="text-2xl font-bold font-mono">CONSTRUDATA</span>
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
              <h1 className="text-3xl font-bold font-mono mb-2">Configurações</h1>
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
                  <div className="flex items-start gap-4 p-4 rounded-none border bg-muted/30">
                    <div className="p-2 rounded-none bg-primary/10">
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
                  <div className="flex items-start gap-4 p-4 rounded-none border bg-muted/30">
                    <div className="p-2 rounded-none bg-secondary/10">
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
                        <div className="mt-2 p-3 rounded-none border bg-card text-sm space-y-1">
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
                  <div className="flex items-start gap-2 p-3 rounded-none bg-warning/10 border border-warning/20">
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

                  {/* 2FA Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      <Label>Autenticação em 2 Fatores (2FA)</Label>
                    </div>

                    {mfaFactors.some((f: any) => f.status === "verified") ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 p-3 rounded-md border bg-green-500/10 border-green-500/20">
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-green-700 dark:text-green-400">
                              2FA está ativa
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Sua conta está protegida com autenticação em dois fatores
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setShowMfaRemoveConfirm(true)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Desativar 2FA
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Adicione uma camada extra de segurança usando um aplicativo autenticador
                          (Google Authenticator, Authy, etc.)
                        </p>
                        <Button
                          variant="outline"
                          onClick={handleMfaEnroll}
                          disabled={isMfaLoading}
                        >
                          {isMfaLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Configurando...
                            </>
                          ) : (
                            <>
                              <Smartphone className="w-4 h-4 mr-2" />
                              Ativar 2FA
                            </>
                          )}
                        </Button>
                      </div>
                    )}
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

              {/* 2FA Setup Dialog */}
              <Dialog open={showMfaSetup} onOpenChange={setShowMfaSetup}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5" />
                      Configurar Autenticação 2FA
                    </DialogTitle>
                    <DialogDescription>
                      Escaneie o QR code com seu aplicativo autenticador e insira o código de verificação
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* QR Code */}
                    {mfaQrCode && (
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-3 bg-white rounded-lg">
                          <img src={mfaQrCode} alt="QR Code 2FA" className="w-48 h-48" />
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                          Escaneie com Google Authenticator, Authy ou similar
                        </p>
                      </div>
                    )}

                    {/* Manual secret */}
                    {mfaSecret && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Ou insira manualmente:
                        </Label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 p-2 text-xs bg-muted rounded font-mono break-all">
                            {mfaSecret}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="flex-shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText(mfaSecret);
                              toast.success("Chave copiada!");
                            }}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Verification code */}
                    <div className="space-y-2">
                      <Label>Código de Verificação</Label>
                      <div className="flex justify-center">
                        <InputOTP
                          maxLength={6}
                          value={mfaVerifyCode}
                          onChange={setMfaVerifyCode}
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        Digite o código de 6 dígitos do seu app autenticador
                      </p>
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleMfaVerify}
                      disabled={isMfaLoading || mfaVerifyCode.length !== 6}
                    >
                      {isMfaLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Verificando...
                        </>
                      ) : (
                        "Verificar e Ativar"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* 2FA Remove Confirmation Dialog */}
              <Dialog open={showMfaRemoveConfirm} onOpenChange={setShowMfaRemoveConfirm}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="w-5 h-5" />
                      Desativar 2FA
                    </DialogTitle>
                    <DialogDescription>
                      Tem certeza que deseja desativar a autenticação em dois fatores?
                      Sua conta ficará menos protegida.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setShowMfaRemoveConfirm(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleMfaUnenroll}
                      disabled={isMfaLoading}
                    >
                      {isMfaLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Desativando...
                        </>
                      ) : (
                        "Desativar 2FA"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Settings;
