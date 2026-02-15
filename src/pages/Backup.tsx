import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Download, Database, Clock, CheckCircle, XCircle, Archive, Mail, Settings } from "lucide-react";
import { BackupExportDialog } from "@/components/backup/BackupExportDialog";

interface Backup {
  id: string;
  backup_type: 'manual' | 'automatic';
  status: 'completed' | 'failed' | 'in_progress';
  file_size: number | null;
  created_at: string;
  project_id: string | null;
  metadata?: {
    tables?: string[];
    format?: string;
  };
  projects?: { name: string };
}

export default function Backup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);

  useEffect(() => {
    checkAuth();
    loadBackups();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    }
    setLoading(false);
  };

  const loadBackups = async () => {
    const { data, error } = await supabase
      .from("backups")
      .select("*, projects(name)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast.error("Erro ao carregar backups");
      console.error(error);
      return;
    }

    setBackups(data || []);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "N/A";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completo</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      case "in_progress":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Em Progresso</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Database className="h-8 w-8" />
                Gerenciamento de Backups
              </h1>
              <p className="text-muted-foreground">
                Exporte seus dados e configure backups automáticos por email
              </p>
            </div>
          </div>
          <Button onClick={() => setShowExportDialog(true)}>
            <Archive className="h-4 w-4 mr-2" />
            Exportar Backup
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Backups</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{backups.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Backups Manuais</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {backups.filter(b => b.backup_type === 'manual').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Backups Automáticos</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {backups.filter(b => b.backup_type === 'automatic').length}
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/50 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Envio por Email</CardTitle>
              <Mail className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => setShowExportDialog(true)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configurar
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Backups</CardTitle>
            <CardDescription>
              Visualize todos os backups realizados. Clique em "Exportar Backup" para criar um novo e configurar envios automáticos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Formato</TableHead>
                  <TableHead>Tabelas</TableHead>
                  <TableHead>Tamanho</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhum backup encontrado. Clique em "Exportar Backup" para criar seu primeiro backup.
                    </TableCell>
                  </TableRow>
                ) : (
                  backups.map((backup) => (
                    <TableRow key={backup.id}>
                      <TableCell>
                        {new Date(backup.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={backup.backup_type === 'manual' ? 'default' : 'secondary'}>
                          {backup.backup_type === 'manual' ? 'Manual' : 'Automático'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(backup.status)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {backup.metadata?.format?.toUpperCase() || "JSON"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {backup.metadata?.tables?.length || "Todas"} tabela(s)
                      </TableCell>
                      <TableCell>
                        {formatFileSize(backup.file_size)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <BackupExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
      />
    </div>
  );
}