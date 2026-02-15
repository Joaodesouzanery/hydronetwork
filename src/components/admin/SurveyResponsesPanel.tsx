import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Eye, FileSpreadsheet, Loader2, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";

interface SurveyResponse {
  id: string;
  user_id: string;
  user_profile: string;
  user_profile_other: string | null;
  operation_type: string;
  operation_type_other: string | null;
  users_count: string;
  nps_score: number | null;
  nps_justification: string | null;
  general_satisfaction: string;
  help_areas: string[];
  one_sentence_summary: string | null;
  ease_of_start: string;
  initial_difficulty: string;
  initial_difficulty_other: string | null;
  most_used_features: string[];
  urgent_improvement: string;
  urgent_improvement_other: string | null;
  would_stop_using: string;
  stop_reason: string | null;
  solution_expectation: string | null;
  data_trust_level: string;
  trust_issues: string[];
  trust_issues_other: string | null;
  generated_results: string;
  hours_saved_per_week: number | null;
  monthly_savings: number | null;
  support_resolution: string;
  preferred_support_format: string;
  one_improvement: string | null;
  indispensable_feature: string | null;
  desired_features: string[];
  would_recommend: string;
  referral_target: string | null;
  created_at: string;
}

export function SurveyResponsesPanel() {
  const [selectedResponse, setSelectedResponse] = useState<SurveyResponse | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ["survey-responses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("satisfaction_surveys")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as SurveyResponse[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["survey-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("satisfaction_surveys")
        .select("nps_score, general_satisfaction, would_recommend");

      if (error) throw error;

      const npsScores = data.filter(d => d.nps_score != null).map(d => d.nps_score as number);
      const avgNps = npsScores.length > 0
        ? npsScores.reduce((a, b) => a + b, 0) / npsScores.length
        : 0;

      const promoters = npsScores.filter(s => s >= 9).length;
      const detractors = npsScores.filter(s => s <= 6).length;
      const npsScore = npsScores.length > 0
        ? Math.round(((promoters - detractors) / npsScores.length) * 100)
        : 0;

      const satisfiedCount = data.filter(d =>
        d.general_satisfaction === "Muito satisfeito" || d.general_satisfaction === "Satisfeito"
      ).length;

      return {
        totalResponses: data.length,
        avgNps: avgNps.toFixed(1),
        npsScore,
        satisfactionRate: data.length > 0 ? Math.round((satisfiedCount / data.length) * 100) : 0,
        recommendRate: data.length > 0
          ? Math.round((data.filter(d => d.would_recommend === "Sim").length / data.length) * 100)
          : 0,
      };
    },
  });

  const exportToExcel = () => {
    const exportData = responses.map(r => ({
      "Data": format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      "Perfil": r.user_profile,
      "Tipo de Operação": r.operation_type,
      "Nº de Usuários": r.users_count,
      "NPS (0-10)": r.nps_score,
      "Justificativa NPS": r.nps_justification,
      "Satisfação Geral": r.general_satisfaction,
      "ConstruData Ajuda Em": r.help_areas?.join(", "),
      "Resumo em 1 Frase": r.one_sentence_summary,
      "Facilidade de Início": r.ease_of_start,
      "Maior Dificuldade": r.initial_difficulty,
      "Funcionalidades Mais Usadas": r.most_used_features?.join(", "),
      "Melhoria Urgente": r.urgent_improvement,
      "Pararia de Usar?": r.would_stop_using,
      "Motivo para Parar": r.stop_reason,
      "Expectativa de Solução": r.solution_expectation,
      "Confiança nos Dados": r.data_trust_level,
      "Problemas de Confiança": r.trust_issues?.join(", "),
      "Gerou Resultado?": r.generated_results,
      "Horas Economizadas/Semana": r.hours_saved_per_week,
      "Economia Mensal (R$)": r.monthly_savings,
      "Resolução de Suporte": r.support_resolution,
      "Formato de Suporte Preferido": r.preferred_support_format,
      "Uma Melhoria": r.one_improvement,
      "Tornaria Indispensável": r.indispensable_feature,
      "Funcionalidades Desejadas": r.desired_features?.join(", "),
      "Recomendaria?": r.would_recommend,
      "Quem Indicaria": r.referral_target,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "Pesquisas de Satisfação");
    XLSX.writeFile(wb, `pesquisas_satisfacao_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const getNpsColor = (score: number | null) => {
    if (score === null) return "secondary";
    if (score >= 9) return "default";
    if (score >= 7) return "secondary";
    return "destructive";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Respostas</CardDescription>
            <CardTitle className="text-3xl">{stats?.totalResponses || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>NPS Score</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {stats?.npsScore || 0}
              <span className="text-sm font-normal text-muted-foreground">
                (média: {stats?.avgNps || 0})
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taxa de Satisfação</CardDescription>
            <CardTitle className="text-3xl">{stats?.satisfactionRate || 0}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taxa de Recomendação</CardDescription>
            <CardTitle className="text-3xl">{stats?.recommendRate || 0}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Responses Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Respostas das Pesquisas
              </CardTitle>
              <CardDescription>
                Visualize e exporte as respostas das pesquisas de satisfação
              </CardDescription>
            </div>
            <Button onClick={exportToExcel} disabled={responses.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {responses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma resposta de pesquisa encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>NPS</TableHead>
                  <TableHead>Satisfação</TableHead>
                  <TableHead>Recomendaria</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses.map((response) => (
                  <TableRow key={response.id}>
                    <TableCell>
                      {format(new Date(response.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{response.user_profile}</TableCell>
                    <TableCell>
                      <Badge variant={getNpsColor(response.nps_score)}>
                        {response.nps_score ?? "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{response.general_satisfaction}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          response.would_recommend === "Sim"
                            ? "default"
                            : response.would_recommend === "Talvez"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {response.would_recommend}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedResponse(response);
                          setShowDetails(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Detalhes da Resposta</DialogTitle>
            <DialogDescription>
              {selectedResponse &&
                format(new Date(selectedResponse.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {selectedResponse && (
              <div className="space-y-4">
                <Section title="Perfil">
                  <Field label="Perfil do Usuário" value={selectedResponse.user_profile} />
                  <Field label="Tipo de Operação" value={selectedResponse.operation_type} />
                  <Field label="Quantidade de Usuários" value={selectedResponse.users_count} />
                </Section>

                <Section title="NPS">
                  <Field label="Nota (0-10)" value={String(selectedResponse.nps_score ?? "-")} />
                  <Field label="Justificativa" value={selectedResponse.nps_justification} />
                </Section>

                <Section title="Satisfação">
                  <Field label="Satisfação Geral" value={selectedResponse.general_satisfaction} />
                  <Field
                    label="ConstruData Ajuda Em"
                    value={selectedResponse.help_areas?.join(", ")}
                  />
                  <Field label="Resumo em 1 Frase" value={selectedResponse.one_sentence_summary} />
                </Section>

                <Section title="Esforço e Fricção">
                  <Field label="Facilidade de Início" value={selectedResponse.ease_of_start} />
                  <Field label="Maior Dificuldade" value={selectedResponse.initial_difficulty} />
                </Section>

                <Section title="Produto">
                  <Field
                    label="Funcionalidades Mais Usadas"
                    value={selectedResponse.most_used_features?.join(", ")}
                  />
                  <Field label="Melhoria Urgente" value={selectedResponse.urgent_improvement} />
                </Section>

                <Section title="Churn Risk">
                  <Field label="Pararia de Usar?" value={selectedResponse.would_stop_using} />
                  {selectedResponse.stop_reason && (
                    <Field label="Motivo" value={selectedResponse.stop_reason} />
                  )}
                  {selectedResponse.solution_expectation && (
                    <Field label="Expectativa" value={selectedResponse.solution_expectation} />
                  )}
                </Section>

                <Section title="Confiança nos Dados">
                  <Field label="Nível de Confiança" value={selectedResponse.data_trust_level} />
                  {selectedResponse.trust_issues?.length > 0 && (
                    <Field label="Problemas" value={selectedResponse.trust_issues.join(", ")} />
                  )}
                </Section>

                <Section title="Resultado / ROI">
                  <Field label="Gerou Resultado?" value={selectedResponse.generated_results} />
                  <Field
                    label="Horas Economizadas/Semana"
                    value={String(selectedResponse.hours_saved_per_week ?? "-")}
                  />
                  <Field
                    label="Economia Mensal (R$)"
                    value={
                      selectedResponse.monthly_savings
                        ? `R$ ${selectedResponse.monthly_savings.toLocaleString("pt-BR")}`
                        : "-"
                    }
                  />
                </Section>

                <Section title="Suporte">
                  <Field label="Resolução de Suporte" value={selectedResponse.support_resolution} />
                  <Field label="Formato Preferido" value={selectedResponse.preferred_support_format} />
                </Section>

                <Section title="Melhorias">
                  <Field label="Uma Melhoria" value={selectedResponse.one_improvement} />
                  <Field label="Tornaria Indispensável" value={selectedResponse.indispensable_feature} />
                  <Field
                    label="Funcionalidades Desejadas"
                    value={selectedResponse.desired_features?.join(", ")}
                  />
                </Section>

                <Section title="Indicação">
                  <Field label="Recomendaria?" value={selectedResponse.would_recommend} />
                  {selectedResponse.referral_target && (
                    <Field label="Quem Indicaria" value={selectedResponse.referral_target} />
                  )}
                </Section>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-sm text-primary border-b pb-1">{title}</h4>
      <div className="space-y-1 pl-2">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="text-foreground">{value}</span>
    </div>
  );
}
