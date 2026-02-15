import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { QrCode, Eye, AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface MaintenanceRequestItem {
  id: string;
  requester_name: string;
  requester_contact?: string;
  issue_description: string;
  urgency_level: string;
  status: string;
  photos_urls: string[];
  created_at: string;
  maintenance_qr_codes: {
    location_name: string;
    projects: { name: string };
  };
}

export default function MaintenanceRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<MaintenanceRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("maintenance_requests")
        .select(`
          *,
          maintenance_qr_codes (
            location_name,
            projects (name)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar solicitações");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendente",
      in_progress: "Em Andamento",
      resolved: "Resolvida"
    };
    return labels[status] || status;
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Solicitações de Manutenção</h1>
              <p className="text-muted-foreground">Recebidas via QR Code</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/maintenance-qr-codes')}>
            Gerenciar QR Codes
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{requests.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {requests.filter(r => r.status === 'pending').length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Solicitações</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma solicitação ainda</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Local</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Urgência</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>{req.maintenance_qr_codes.location_name}</TableCell>
                      <TableCell>{req.requester_name}</TableCell>
                      <TableCell>
                        <Badge variant={req.urgency_level === 'urgente' ? 'destructive' : 'secondary'}>
                          {req.urgency_level}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusLabel(req.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
