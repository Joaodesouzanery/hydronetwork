import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Upload, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AddEmployeeDialog } from "@/components/employees/AddEmployeeDialog";
import { ImportEmployeesDialog } from "@/components/employees/ImportEmployeesDialog";
import { PageTutorialButton } from "@/components/shared/PageTutorialButton";

interface Employee {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  department: string;
  company_name: string;
  status: string;
  project_id: string;
  construction_site_id: string;
  created_at: string;
  projects?: { name: string };
  construction_sites?: { name: string };
}

export default function Employees() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchEmployees();
  }, [statusFilter]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("employees")
        .select(`
          *,
          projects(name),
          construction_sites(name)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      console.error("Error fetching employees:", error);
      toast.error("Erro ao carregar funcionários");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este funcionário?")) return;

    try {
      const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Funcionário excluído com sucesso");
      fetchEmployees();
    } catch (error: any) {
      console.error("Error deleting employee:", error);
      toast.error("Erro ao excluir funcionário");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      active: "default",
      inactive: "secondary",
      suspended: "destructive",
    };

    const labels: Record<string, string> = {
      active: "Ativo",
      inactive: "Inativo",
      suspended: "Suspenso",
    };

    return <Badge variant={variants[status] || "default"}>{labels[status] || status}</Badge>;
  };

  const filteredEmployees = employees.filter((employee) =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Funcionários</h1>
              <p className="text-sm text-muted-foreground">Gerencie todos os funcionários do sistema</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <PageTutorialButton pageKey="employees" />
            <Button 
              onClick={() => setImportDialogOpen(true)} 
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Upload className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Importar</span>
              <span className="sm:hidden">Importar Funcionários</span>
            </Button>
            <Button 
              onClick={() => setAddDialogOpen(true)}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Adicionar</span>
              <span className="sm:hidden">Adicionar Funcionário</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Lista de Funcionários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, cargo ou departamento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="suspended">Suspenso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum funcionário encontrado
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Nome</TableHead>
                      <TableHead className="hidden sm:table-cell min-w-[120px]">Cargo</TableHead>
                      <TableHead className="hidden md:table-cell min-w-[120px]">Departamento</TableHead>
                      <TableHead className="hidden lg:table-cell min-w-[120px]">Empresa</TableHead>
                      <TableHead className="hidden xl:table-cell min-w-[150px]">Projeto</TableHead>
                      <TableHead className="hidden 2xl:table-cell min-w-[120px]">Local</TableHead>
                      <TableHead className="hidden lg:table-cell min-w-[130px]">Telefone</TableHead>
                      <TableHead className="min-w-[80px]">Status</TableHead>
                      <TableHead className="text-right min-w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell className="font-medium">
                          <div>
                            <div>{employee.name}</div>
                            <div className="text-xs text-muted-foreground sm:hidden mt-1">
                              {employee.role || "-"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{employee.role || "-"}</TableCell>
                        <TableCell className="hidden md:table-cell">{employee.department || "-"}</TableCell>
                        <TableCell className="hidden lg:table-cell">{employee.company_name || "-"}</TableCell>
                        <TableCell className="hidden xl:table-cell">{employee.projects?.name || "-"}</TableCell>
                        <TableCell className="hidden 2xl:table-cell">{employee.construction_sites?.name || "-"}</TableCell>
                        <TableCell className="hidden lg:table-cell">{employee.phone || "-"}</TableCell>
                        <TableCell>{getStatusBadge(employee.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => toast.info("Funcionalidade em desenvolvimento")}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDeleteEmployee(employee.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AddEmployeeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={() => {
          fetchEmployees();
          setAddDialogOpen(false);
        }}
      />

      <ImportEmployeesDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={() => {
          fetchEmployees();
          setImportDialogOpen(false);
        }}
      />
    </div>
  );
}
