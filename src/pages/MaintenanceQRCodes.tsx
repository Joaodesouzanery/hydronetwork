import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { QrCode, Plus, ArrowLeft, Download, Eye, Trash2, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { AddQRCodeDialog } from "@/components/maintenance/AddQRCodeDialog";
import { QRCodeDialog } from "@/components/maintenance/QRCodeDialog";
import { TutorialDialog } from "@/components/shared/TutorialDialog";

interface QRCodeItem {
  id: string;
  project_id: string;
  location_name: string;
  location_description?: string;
  qr_code_data: string;
  is_active: boolean;
  created_at: string;
  projects: { name: string };
}

export default function MaintenanceQRCodes() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [qrCodes, setQrCodes] = useState<QRCodeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedQRCode, setSelectedQRCode] = useState<QRCodeItem | null>(null);
  const [showQRDialog, setShowQRDialog] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchQRCodes();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setUser(session.user);
  };

  const fetchQRCodes = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("maintenance_qr_codes")
        .select(`
          *,
          projects (name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQrCodes(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar QR Codes: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleQRCodeStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("maintenance_qr_codes")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success(!currentStatus ? "QR Code ativado!" : "QR Code desativado!");
      fetchQRCodes();
    } catch (error: any) {
      toast.error("Erro ao atualizar status: " + error.message);
    }
  };

  const deleteQRCode = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este QR Code?")) return;

    try {
      const { error } = await supabase
        .from("maintenance_qr_codes")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("QR Code excluído!");
      fetchQRCodes();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const handleViewQRCode = (qrCode: QRCodeItem) => {
    setSelectedQRCode(qrCode);
    setShowQRDialog(true);
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <QrCode className="h-8 w-8" />
                QR Codes de Manutenção
              </h1>
              <p className="text-muted-foreground">
                Gere QR Codes para locais da obra e receba solicitações de manutenção
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTutorial(true)}>
              <HelpCircle className="mr-2 h-4 w-4" />
              Tutorial
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo QR Code
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total de QR Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{qrCodes.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {qrCodes.filter(q => q.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Inativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-400">
                {qrCodes.filter(q => !q.is_active).length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>QR Codes Cadastrados</CardTitle>
            <CardDescription>
              Gerencie os QR Codes para solicitação de manutenção
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando...
              </div>
            ) : qrCodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <QrCode className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum QR Code cadastrado</p>
                <p className="text-sm">Clique em "Novo QR Code" para começar</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Local</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qrCodes.map((qr) => (
                    <TableRow key={qr.id}>
                      <TableCell className="font-medium">{qr.location_name}</TableCell>
                      <TableCell>{qr.projects.name}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {qr.location_description || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={qr.is_active ? "default" : "secondary"}>
                          {qr.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewQRCode(qr)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleQRCodeStatus(qr.id, qr.is_active)}
                        >
                          {qr.is_active ? "Desativar" : "Ativar"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteQRCode(qr.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AddQRCodeDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={fetchQRCodes}
      />

      {selectedQRCode && (
        <QRCodeDialog
          open={showQRDialog}
          onOpenChange={setShowQRDialog}
          qrCode={selectedQRCode}
        />
      )}

      <TutorialDialog
        open={showTutorial}
        onOpenChange={setShowTutorial}
        title="Tutorial: QR Codes de Manutenção"
        steps={[
          {
            title: "Criar QR Code",
            description: "Clique em 'Novo QR Code' e selecione o projeto e local (ex: Sala de Estar, Banheiro, etc). Um QR Code único será gerado."
          },
          {
            title: "Imprimir e Colar",
            description: "Visualize o QR Code gerado, faça o download ou imprima diretamente. Cole o QR Code no local correspondente da obra."
          },
          {
            title: "Receber Solicitações",
            description: "Quando alguém escanear o QR Code, poderá solicitar manutenção para aquele local específico. Você receberá a solicitação com fotos e descrição do problema."
          },
          {
            title: "Gerenciar Status",
            description: "Você pode ativar/desativar QR Codes a qualquer momento. QR Codes inativos não aceitarão novas solicitações."
          }
        ]}
      />
    </div>
  );
}
