import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowRight, Check, X, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const TOTAL_SECTIONS = 11;

interface SurveyData {
  // Section 1
  userProfile: string;
  userProfileOther: string;
  operationType: string;
  operationTypeOther: string;
  usersCount: string;
  // Section 2
  npsScore: number | null;
  npsJustification: string;
  // Section 3
  generalSatisfaction: string;
  helpAreas: string[];
  oneSentenceSummary: string;
  // Section 4
  easeOfStart: string;
  initialDifficulty: string;
  initialDifficultyOther: string;
  // Section 5
  mostUsedFeatures: string[];
  urgentImprovement: string;
  urgentImprovementOther: string;
  // Section 6
  wouldStopUsing: string;
  stopReason: string;
  solutionExpectation: string;
  // Section 7
  dataTrustLevel: string;
  trustIssues: string[];
  trustIssuesOther: string;
  // Section 8
  generatedResults: string;
  hoursSavedPerWeek: string;
  monthlySavings: string;
  // Section 9
  supportResolution: string;
  preferredSupportFormat: string;
  // Section 10
  oneImprovement: string;
  indispensableFeature: string;
  desiredFeatures: string[];
  // Section 11
  wouldRecommend: string;
  referralTarget: string;
}

const initialData: SurveyData = {
  userProfile: "",
  userProfileOther: "",
  operationType: "",
  operationTypeOther: "",
  usersCount: "",
  npsScore: null,
  npsJustification: "",
  generalSatisfaction: "",
  helpAreas: [],
  oneSentenceSummary: "",
  easeOfStart: "",
  initialDifficulty: "",
  initialDifficultyOther: "",
  mostUsedFeatures: [],
  urgentImprovement: "",
  urgentImprovementOther: "",
  wouldStopUsing: "",
  stopReason: "",
  solutionExpectation: "",
  dataTrustLevel: "",
  trustIssues: [],
  trustIssuesOther: "",
  generatedResults: "",
  hoursSavedPerWeek: "",
  monthlySavings: "",
  supportResolution: "",
  preferredSupportFormat: "",
  oneImprovement: "",
  indispensableFeature: "",
  desiredFeatures: [],
  wouldRecommend: "",
  referralTarget: "",
};

const SatisfactionSurvey = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentSection, setCurrentSection] = useState(1);
  const [data, setData] = useState<SurveyData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canShowSurvey, setCanShowSurvey] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    checkSurveyAvailability();
  }, []);

  const checkSurveyAvailability = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: surveys } = await supabase
      .from("satisfaction_surveys")
      .select("created_at, dismissed_at, next_available_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (surveys && surveys.length > 0) {
      const lastSurvey = surveys[0];
      const nextAvailable = lastSurvey.next_available_at 
        ? new Date(lastSurvey.next_available_at) 
        : null;
      
      if (nextAvailable && nextAvailable > new Date()) {
        setCanShowSurvey(false);
      }
    }
  };

  const progress = Math.round((currentSection / TOTAL_SECTIONS) * 100);

  const updateField = <K extends keyof SurveyData>(field: K, value: SurveyData[K]) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field: keyof SurveyData, item: string) => {
    const arr = data[field] as string[];
    if (arr.includes(item)) {
      updateField(field, arr.filter(i => i !== item) as any);
    } else {
      updateField(field, [...arr, item] as any);
    }
  };

  const canProceed = (): boolean => {
    switch (currentSection) {
      case 1:
        return !!data.userProfile && !!data.operationType && !!data.usersCount;
      case 2:
        return data.npsScore !== null;
      case 3:
        return !!data.generalSatisfaction;
      case 4:
        return !!data.easeOfStart && !!data.initialDifficulty;
      case 5:
        return data.mostUsedFeatures.length > 0 && !!data.urgentImprovement;
      case 6:
        return !!data.wouldStopUsing;
      case 7:
        return !!data.dataTrustLevel;
      case 8:
        return !!data.generatedResults;
      case 9:
        return !!data.supportResolution && !!data.preferredSupportFormat;
      case 10:
        return true;
      case 11:
        return !!data.wouldRecommend;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentSection < TOTAL_SECTIONS) {
      setCurrentSection(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSection > 1) {
      setCurrentSection(prev => prev - 1);
    }
  };

  const getNextFriday11AM = (): Date => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    const nextFriday = new Date(now);
    nextFriday.setDate(now.getDate() + daysUntilFriday);
    nextFriday.setHours(11, 0, 0, 0);
    return nextFriday;
  };

  const handleDismiss = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const nextAvailable = getNextFriday11AM();

    await supabase.from("satisfaction_surveys").insert({
      user_id: user.id,
      user_profile: "dismissed",
      operation_type: "dismissed",
      users_count: "dismissed",
      nps_score: 0,
      general_satisfaction: "dismissed",
      ease_of_start: "dismissed",
      initial_difficulty: "dismissed",
      urgent_improvement: "dismissed",
      would_stop_using: "dismissed",
      data_trust_level: "dismissed",
      generated_results: "dismissed",
      support_resolution: "dismissed",
      preferred_support_format: "dismissed",
      would_recommend: "dismissed",
      dismissed_at: new Date().toISOString(),
      next_available_at: nextAvailable.toISOString(),
    });

    toast({
      title: "Pesquisa fechada",
      description: "A pesquisa estará disponível novamente na próxima sexta-feira às 11:00.",
    });
    navigate("/dashboard");
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const nextAvailable = getNextFriday11AM();

      const { error } = await supabase.from("satisfaction_surveys").insert({
        user_id: user.id,
        user_profile: data.userProfile,
        user_profile_other: data.userProfileOther || null,
        operation_type: data.operationType,
        operation_type_other: data.operationTypeOther || null,
        users_count: data.usersCount,
        nps_score: data.npsScore,
        nps_justification: data.npsJustification || null,
        general_satisfaction: data.generalSatisfaction,
        help_areas: data.helpAreas,
        one_sentence_summary: data.oneSentenceSummary || null,
        ease_of_start: data.easeOfStart,
        initial_difficulty: data.initialDifficulty,
        initial_difficulty_other: data.initialDifficultyOther || null,
        most_used_features: data.mostUsedFeatures,
        urgent_improvement: data.urgentImprovement,
        urgent_improvement_other: data.urgentImprovementOther || null,
        would_stop_using: data.wouldStopUsing,
        stop_reason: data.stopReason || null,
        solution_expectation: data.solutionExpectation || null,
        data_trust_level: data.dataTrustLevel,
        trust_issues: data.trustIssues,
        trust_issues_other: data.trustIssuesOther || null,
        generated_results: data.generatedResults,
        hours_saved_per_week: data.hoursSavedPerWeek ? parseFloat(data.hoursSavedPerWeek) : null,
        monthly_savings: data.monthlySavings ? parseFloat(data.monthlySavings) : null,
        support_resolution: data.supportResolution,
        preferred_support_format: data.preferredSupportFormat,
        one_improvement: data.oneImprovement || null,
        indispensable_feature: data.indispensableFeature || null,
        desired_features: data.desiredFeatures,
        would_recommend: data.wouldRecommend,
        referral_target: data.referralTarget || null,
        next_available_at: nextAvailable.toISOString(),
      });

      if (error) throw error;

      setShowSuccess(true);
    } catch (error: any) {
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Obrigado! ✅</h2>
              <p className="text-muted-foreground">
                Sua resposta melhora o ConstruData.
              </p>
            </div>
            <Button onClick={() => navigate("/dashboard")} className="w-full">
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canShowSurvey) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <p className="text-muted-foreground">
              A pesquisa estará disponível na próxima sexta-feira às 11:00.
            </p>
            <Button onClick={() => navigate("/dashboard")}>Voltar ao Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const RadioOption = ({ value, label }: { value: string; label: string }) => (
    <div className="flex items-center space-x-2">
      <RadioGroupItem value={value} id={value} />
      <Label htmlFor={value} className="cursor-pointer">{label}</Label>
    </div>
  );

  const CheckboxOption = ({ field, value, label }: { field: keyof SurveyData; value: string; label: string }) => (
    <div className="flex items-center space-x-2">
      <Checkbox
        id={`${field}-${value}`}
        checked={(data[field] as string[]).includes(value)}
        onCheckedChange={() => toggleArrayItem(field, value)}
      />
      <Label htmlFor={`${field}-${value}`} className="cursor-pointer">{label}</Label>
    </div>
  );

  const renderSection = () => {
    switch (currentSection) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">1. Perfil do usuário *</Label>
              <RadioGroup value={data.userProfile} onValueChange={(v) => updateField("userProfile", v)}>
                <RadioOption value="dono_socio" label="Dono/Sócio" />
                <RadioOption value="engenheiro_rt" label="Engenheiro/RT" />
                <RadioOption value="compras" label="Compras" />
                <RadioOption value="orcamentista" label="Orçamentista/Precificador" />
                <RadioOption value="financeiro" label="Financeiro" />
                <RadioOption value="administrativo_rh" label="Administrativo/RH" />
                <RadioOption value="outro" label="Outro" />
              </RadioGroup>
              {data.userProfile === "outro" && (
                <Input
                  placeholder="Especifique..."
                  value={data.userProfileOther}
                  onChange={(e) => updateField("userProfileOther", e.target.value)}
                />
              )}
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium">2. Tipo de operação *</Label>
              <RadioGroup value={data.operationType} onValueChange={(v) => updateField("operationType", v)}>
                <RadioOption value="obras_construcao" label="Obras/Construção" />
                <RadioOption value="reforma" label="Reforma" />
                <RadioOption value="manutencao_facilities" label="Manutenção/Facilities" />
                <RadioOption value="servicos_gerais" label="Serviços gerais" />
                <RadioOption value="outro" label="Outro" />
              </RadioGroup>
              {data.operationType === "outro" && (
                <Input
                  placeholder="Especifique..."
                  value={data.operationTypeOther}
                  onChange={(e) => updateField("operationTypeOther", e.target.value)}
                />
              )}
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium">3. Quantos usuários usam o sistema? *</Label>
              <RadioGroup value={data.usersCount} onValueChange={(v) => updateField("usersCount", v)}>
                <RadioOption value="so_eu" label="Só eu" />
                <RadioOption value="2_5" label="2–5" />
                <RadioOption value="6_15" label="6–15" />
                <RadioOption value="16_mais" label="16+" />
              </RadioGroup>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">4. De 0 a 10, qual a probabilidade de você recomendar o ConstruData? *</Label>
              <div className="flex gap-2 flex-wrap justify-center">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={data.npsScore === n ? "default" : "outline"}
                    className={cn(
                      "w-12 h-12 text-lg font-bold",
                      data.npsScore === n && "ring-2 ring-primary"
                    )}
                    onClick={() => updateField("npsScore", n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
              <div className="flex justify-between text-sm text-muted-foreground px-2">
                <span>Improvável</span>
                <span>Muito provável</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">5. Justificativa da nota</Label>
              <Textarea
                placeholder="Por que você deu essa nota?"
                value={data.npsJustification}
                onChange={(e) => updateField("npsJustification", e.target.value)}
                rows={4}
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">6. Satisfação geral com o ConstruData *</Label>
              <RadioGroup value={data.generalSatisfaction} onValueChange={(v) => updateField("generalSatisfaction", v)}>
                <RadioOption value="muito_satisfeito" label="Muito satisfeito" />
                <RadioOption value="satisfeito" label="Satisfeito" />
                <RadioOption value="neutro" label="Neutro" />
                <RadioOption value="insatisfeito" label="Insatisfeito" />
                <RadioOption value="muito_insatisfeito" label="Muito insatisfeito" />
              </RadioGroup>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium">7. O ConstruData te ajuda em quê? (múltipla escolha)</Label>
              <div className="grid gap-2">
                <CheckboxOption field="helpAreas" value="organizar_precificacao" label="Organizar precificação" />
                <CheckboxOption field="helpAreas" value="padronizar_materiais" label="Padronizar materiais e serviços" />
                <CheckboxOption field="helpAreas" value="evitar_duplicidade" label="Evitar duplicidade de itens" />
                <CheckboxOption field="helpAreas" value="reduzir_erro" label="Reduzir erro humano" />
                <CheckboxOption field="helpAreas" value="reduzir_retrabalho" label="Reduzir retrabalho" />
                <CheckboxOption field="helpAreas" value="controle_custo" label="Melhorar controle de custo" />
                <CheckboxOption field="helpAreas" value="economizar_tempo" label="Economizar tempo" />
                <CheckboxOption field="helpAreas" value="nao_ajudou" label="Ainda não ajudou de forma clara" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">8. Resuma o ConstruData em 1 frase</Label>
              <Input
                placeholder="Ex: Uma ferramenta que..."
                value={data.oneSentenceSummary}
                onChange={(e) => updateField("oneSentenceSummary", e.target.value)}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">9. Facilidade de começar a usar o sistema *</Label>
              <RadioGroup value={data.easeOfStart} onValueChange={(v) => updateField("easeOfStart", v)}>
                <RadioOption value="muito_facil" label="Muito fácil" />
                <RadioOption value="facil" label="Fácil" />
                <RadioOption value="medio" label="Médio" />
                <RadioOption value="dificil" label="Difícil" />
                <RadioOption value="muito_dificil" label="Muito difícil" />
              </RadioGroup>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium">10. Maior dificuldade inicial *</Label>
              <RadioGroup value={data.initialDifficulty} onValueChange={(v) => updateField("initialDifficulty", v)}>
                <RadioOption value="entender_plataforma" label="Entender plataforma" />
                <RadioOption value="importar_planilhas" label="Importar planilhas" />
                <RadioOption value="cadastrar_materiais" label="Cadastrar materiais" />
                <RadioOption value="categorias_unidades" label="Categorias/unidades" />
                <RadioOption value="preco_mo" label="Preço M.O" />
                <RadioOption value="palavras_chave" label="Palavras-chave" />
                <RadioOption value="falta_tutorial" label="Falta de tutorial" />
                <RadioOption value="outro" label="Outro" />
              </RadioGroup>
              {data.initialDifficulty === "outro" && (
                <Input
                  placeholder="Especifique..."
                  value={data.initialDifficultyOther}
                  onChange={(e) => updateField("initialDifficultyOther", e.target.value)}
                />
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">11. Funcionalidades mais usadas (selecione até 3) *</Label>
              <div className="grid gap-2">
                <CheckboxOption field="mostUsedFeatures" value="precos" label="Preços" />
                <CheckboxOption field="mostUsedFeatures" value="precificacao_importacao" label="Precificação/importação" />
                <CheckboxOption field="mostUsedFeatures" value="identificar_materiais" label="Identificar novos materiais" />
                <CheckboxOption field="mostUsedFeatures" value="palavras_chave" label="Palavras-chave" />
                <CheckboxOption field="mostUsedFeatures" value="categorias_unidades" label="Categorias/unidades/medidas" />
                <CheckboxOption field="mostUsedFeatures" value="relatorios" label="Relatórios" />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium">12. O que precisa melhorar urgente? *</Label>
              <RadioGroup value={data.urgentImprovement} onValueChange={(v) => updateField("urgentImprovement", v)}>
                <RadioOption value="performance" label="Performance" />
                <RadioOption value="importacao" label="Importação" />
                <RadioOption value="matching_keywords" label="Matching por palavras-chave" />
                <RadioOption value="padronizacao" label="Padronização" />
                <RadioOption value="interface" label="Interface" />
                <RadioOption value="relatorios_dashboards" label="Relatórios/Dashboards" />
                <RadioOption value="multiusuario" label="Multiusuário" />
                <RadioOption value="suporte" label="Suporte" />
                <RadioOption value="outro" label="Outro" />
              </RadioGroup>
              {data.urgentImprovement === "outro" && (
                <Input
                  placeholder="Especifique..."
                  value={data.urgentImprovementOther}
                  onChange={(e) => updateField("urgentImprovementOther", e.target.value)}
                />
              )}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">13. Existe algo que faria você parar de usar? *</Label>
              <RadioGroup value={data.wouldStopUsing} onValueChange={(v) => updateField("wouldStopUsing", v)}>
                <RadioOption value="nao" label="Não" />
                <RadioOption value="talvez" label="Talvez" />
                <RadioOption value="sim" label="Sim" />
              </RadioGroup>
            </div>

            {(data.wouldStopUsing === "talvez" || data.wouldStopUsing === "sim") && (
              <>
                <div className="space-y-2">
                  <Label className="text-base font-medium">14. Qual ponto específico?</Label>
                  <Textarea
                    placeholder="Descreva o que te faria parar de usar..."
                    value={data.stopReason}
                    onChange={(e) => updateField("stopReason", e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-medium">15. Expectativa de solução</Label>
                  <Textarea
                    placeholder="O que você espera que seja feito?"
                    value={data.solutionExpectation}
                    onChange={(e) => updateField("solutionExpectation", e.target.value)}
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>
        );

      case 7:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">16. Você confia nos dados e preços do sistema? *</Label>
              <RadioGroup value={data.dataTrustLevel} onValueChange={(v) => updateField("dataTrustLevel", v)}>
                <RadioOption value="confio_muito" label="Confio muito" />
                <RadioOption value="confio" label="Confio" />
                <RadioOption value="parcialmente" label="Parcialmente" />
                <RadioOption value="nao_confio" label="Não confio" />
                <RadioOption value="nao_usei_suficiente" label="Ainda não usei o suficiente" />
              </RadioGroup>
            </div>

            {(data.dataTrustLevel === "parcialmente" || data.dataTrustLevel === "nao_confio") && (
              <div className="space-y-4">
                <Label className="text-base font-medium">17. Motivos (múltipla escolha)</Label>
                <div className="grid gap-2">
                  <CheckboxOption field="trustIssues" value="duplicidade" label="Duplicidade" />
                  <CheckboxOption field="trustIssues" value="palavras_chave_falham" label="Palavras-chave falham" />
                  <CheckboxOption field="trustIssues" value="unidade_confusa" label="Unidade/medida confusa" />
                  <CheckboxOption field="trustIssues" value="preco_mo_inconsistente" label="Preço M.O inconsistente" />
                  <CheckboxOption field="trustIssues" value="importacao_errada" label="Importação errada" />
                  <CheckboxOption field="trustIssues" value="falta_historico" label="Falta histórico" />
                  <CheckboxOption field="trustIssues" value="outro" label="Outro" />
                </div>
                {data.trustIssues.includes("outro") && (
                  <Input
                    placeholder="Especifique..."
                    value={data.trustIssuesOther}
                    onChange={(e) => updateField("trustIssuesOther", e.target.value)}
                  />
                )}
              </div>
            )}
          </div>
        );

      case 8:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">18. O ConstruData já gerou resultado para você? *</Label>
              <RadioGroup value={data.generatedResults} onValueChange={(v) => updateField("generatedResults", v)}>
                <RadioOption value="sim_financeiro" label="Sim, financeiro" />
                <RadioOption value="sim_tempo" label="Sim, economizou tempo" />
                <RadioOption value="sim_menos_erro" label="Sim, menos erros" />
                <RadioOption value="ainda_nao" label="Ainda não" />
                <RadioOption value="nao_sei_medir" label="Não sei medir" />
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">19. Estimativas (opcional)</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Horas economizadas por semana</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 5"
                    value={data.hoursSavedPerWeek}
                    onChange={(e) => updateField("hoursSavedPerWeek", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Economia financeira mensal (R$)</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 1000"
                    value={data.monthlySavings}
                    onChange={(e) => updateField("monthlySavings", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 9:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">20. Você resolve rápido quando precisa de ajuda? *</Label>
              <RadioGroup value={data.supportResolution} onValueChange={(v) => updateField("supportResolution", v)}>
                <RadioOption value="sim_sempre" label="Sim, sempre" />
                <RadioOption value="maioria" label="Na maioria das vezes" />
                <RadioOption value="as_vezes" label="Às vezes" />
                <RadioOption value="quase_nunca" label="Quase nunca" />
                <RadioOption value="nunca_precisei" label="Nunca precisei" />
              </RadioGroup>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium">21. Formato de suporte preferido *</Label>
              <RadioGroup value={data.preferredSupportFormat} onValueChange={(v) => updateField("preferredSupportFormat", v)}>
                <RadioOption value="whatsapp" label="WhatsApp" />
                <RadioOption value="chat_sistema" label="Chat no sistema" />
                <RadioOption value="video_curto" label="Vídeo curto" />
                <RadioOption value="treinamento_15min" label="Treinamento 15 min" />
                <RadioOption value="faq" label="FAQ" />
              </RadioGroup>
            </div>
          </div>
        );

      case 10:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-base font-medium">22. Se pudesse pedir 1 melhoria agora, qual seria?</Label>
              <Textarea
                placeholder="Descreva a melhoria que você mais deseja..."
                value={data.oneImprovement}
                onChange={(e) => updateField("oneImprovement", e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">23. O que faria o ConstruData ser indispensável para você?</Label>
              <Textarea
                placeholder="Descreva..."
                value={data.indispensableFeature}
                onChange={(e) => updateField("indispensableFeature", e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium">24. Funcionalidades futuras desejadas (múltipla escolha)</Label>
              <div className="grid gap-2">
                <CheckboxOption field="desiredFeatures" value="dashboard_obra" label="Dashboard por obra" />
                <CheckboxOption field="desiredFeatures" value="compras_desperdicio" label="Compras/desperdício" />
                <CheckboxOption field="desiredFeatures" value="fornecedores" label="Fornecedores" />
                <CheckboxOption field="desiredFeatures" value="estoque" label="Estoque" />
                <CheckboxOption field="desiredFeatures" value="relatorios_automaticos" label="Relatórios automáticos" />
                <CheckboxOption field="desiredFeatures" value="integracoes" label="Integrações" />
                <CheckboxOption field="desiredFeatures" value="aprovacao_precos" label="Aprovação de preços" />
                <CheckboxOption field="desiredFeatures" value="permissoes" label="Permissões" />
                <CheckboxOption field="desiredFeatures" value="historico_audit" label="Histórico/audit log" />
                <CheckboxOption field="desiredFeatures" value="app_mobile" label="App mobile" />
                <CheckboxOption field="desiredFeatures" value="outro" label="Outro" />
              </div>
            </div>
          </div>
        );

      case 11:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">25. Você indicaria o ConstruData para alguém? *</Label>
              <RadioGroup value={data.wouldRecommend} onValueChange={(v) => updateField("wouldRecommend", v)}>
                <RadioOption value="sim" label="Sim" />
                <RadioOption value="talvez" label="Talvez" />
                <RadioOption value="nao" label="Não" />
              </RadioGroup>
            </div>

            {data.wouldRecommend === "sim" && (
              <div className="space-y-2">
                <Label className="text-base font-medium">26. Para quem indicaria?</Label>
                <Textarea
                  placeholder="Ex: outros engenheiros, empresas de construção..."
                  value={data.referralTarget}
                  onChange={(e) => updateField("referralTarget", e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const sectionTitles = [
    "Perfil",
    "NPS",
    "Satisfação",
    "Esforço e Fricção",
    "Produto",
    "Risco de Churn",
    "Confiança nos Dados",
    "Resultado / ROI",
    "Suporte",
    "Melhorias",
    "Indicação",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button variant="ghost" onClick={handleDismiss} className="text-muted-foreground">
            <X className="h-4 w-4 mr-2" />
            Fechar pesquisa
          </Button>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Pesquisa de Satisfação – ConstruData</CardTitle>
            <CardDescription>
              Tempo estimado: 3–5 minutos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-primary">
                  Seção {currentSection}: {sectionTitles[currentSection - 1]}
                </span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {renderSection()}

            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={currentSection === 1}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Anterior
              </Button>

              {currentSection < TOTAL_SECTIONS ? (
                <Button onClick={handleNext} disabled={!canProceed()}>
                  Próximo
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit} 
                  disabled={!canProceed() || isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? "Enviando..." : "Enviar"}
                  <Check className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SatisfactionSurvey;
