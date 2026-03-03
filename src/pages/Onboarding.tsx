import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Building2, ArrowRight, ArrowLeft, CheckCircle2, User, Briefcase,
  Rocket, MapPin, ClipboardList, BarChart3, Package, Calendar,
  Shield, Zap, Globe, Layers, GraduationCap, Mail, Linkedin, MessageCircle
} from "lucide-react";
import { z } from "zod";

const onboardingSchema = z.object({
  company_name: z.string().min(2, "Nome da empresa é obrigatório"),
  company_size: z.string().min(1, "Selecione o porte da empresa"),
  segment: z.string().min(1, "Selecione o segmento"),
  role: z.string().min(1, "Selecione seu cargo"),
  phone: z.string().min(10, "Telefone inválido"),
  main_challenge: z.string().optional(),
});

const companySizes = [
  { value: "1-10", label: "1-10 funcionários" },
  { value: "11-50", label: "11-50 funcionários" },
  { value: "51-200", label: "51-200 funcionários" },
  { value: "201-500", label: "201-500 funcionários" },
  { value: "500+", label: "Mais de 500 funcionários" },
];

const segments = [
  { value: "construcao_civil", label: "Construção Civil" },
  { value: "infraestrutura", label: "Infraestrutura" },
  { value: "saneamento", label: "Saneamento" },
  { value: "energia", label: "Energia" },
  { value: "incorporadora", label: "Incorporadora" },
  { value: "construtora", label: "Construtora" },
  { value: "empreiteira", label: "Empreiteira" },
  { value: "manutencao_predial", label: "Manutenção Predial" },
  { value: "outro", label: "Outro" },
];

const roles = [
  { value: "proprietario", label: "Proprietário / Sócio" },
  { value: "diretor", label: "Diretor" },
  { value: "gerente", label: "Gerente de Projetos" },
  { value: "engenheiro", label: "Engenheiro" },
  { value: "coordenador", label: "Coordenador" },
  { value: "administrativo", label: "Administrativo" },
  { value: "outro", label: "Outro" },
];

const tourHighlights = [
  {
    icon: ClipboardList,
    title: "RDO Digital",
    description: "Registre diários de obra com fotos, GPS e dados climáticos — direto do celular ou computador.",
  },
  {
    icon: BarChart3,
    title: "Dashboard 360°",
    description: "Acompanhe KPIs de todos os projetos em tempo real com gráficos e alertas automáticos.",
  },
  {
    icon: Layers,
    title: "HydroNetwork",
    description: "Dimensione redes de esgoto, água e drenagem conforme normas ABNT, tudo integrado.",
  },
  {
    icon: Calendar,
    title: "Planejamento",
    description: "Gantt com caminho crítico, Curva S automática e análise de valor agregado (EVM).",
  },
  {
    icon: Package,
    title: "Materiais",
    description: "Almoxarifado inteligente com controle de estoque, pedidos e alertas de estoque mínimo.",
  },
  {
    icon: Shield,
    title: "Revisão por Pares",
    description: "Checklist normativo ABNT para validação técnica dos seus projetos.",
  },
];

const TOTAL_STEPS = 4;

const Onboarding = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [createDemoProject, setCreateDemoProject] = useState(true);
  const [formData, setFormData] = useState({
    company_name: "",
    company_size: "",
    segment: "",
    role: "",
    phone: "",
    main_challenge: "",
  });

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('onboarding_completed')
        .eq('user_id', session.user.id)
        .single();

      if (profile?.onboarding_completed) {
        navigate('/dashboard');
      }
    };

    checkSession();
  }, [navigate]);

  const handleSubmit = async () => {
    setIsLoading(true);

    try {
      const validation = onboardingSchema.safeParse(formData);
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        setIsLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        navigate('/auth');
        return;
      }

      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      const { error } = await supabase.from('user_profiles').upsert({
        user_id: session.user.id,
        company_name: formData.company_name,
        company_size: formData.company_size,
        segment: formData.segment,
        role: formData.role,
        phone: formData.phone,
        main_challenge: formData.main_challenge,
        onboarding_completed: true,
        trial_ends_at: trialEndDate.toISOString(),
      });

      if (error) throw error;

      // Create demo project if requested
      if (createDemoProject) {
        try {
          await supabase.from('projects').insert({
            user_id: session.user.id,
            name: "Projeto Demonstração - " + formData.company_name,
            description: "Projeto de demonstração criado automaticamente durante o onboarding. Explore os módulos à vontade!",
            status: "active",
            address: "Endereço de exemplo — edite conforme necessário",
          });
        } catch {
          // Demo project creation is non-critical
        }
      }

      toast.success("Bem-vindo ao ConstruData! Seu teste grátis de 30 dias começou.");
      navigate('/dashboard');
    } catch (error: unknown) {
      toast.error("Erro ao salvar informações. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const stepLabels = ["Sua Empresa", "Sobre Você", "Tour da Plataforma", "Finalizar"];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-3 sm:p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-4 sm:mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img src="/logo.svg" alt="ConstruData" className="h-8 sm:h-10" />
          </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold font-mono">
            {step === 1 && "Conte sobre sua empresa"}
            {step === 2 && "Sobre você"}
            {step === 3 && "Conheça a plataforma"}
            {step === 4 && "Tudo pronto!"}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 font-mono">
            Etapa {step} de {TOTAL_STEPS}
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-4 sm:mb-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 transition-all duration-300 ${
                i < step ? "bg-[#FF6B2C]" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <Card className="border border-border">
          <CardContent className="p-4 sm:p-6">
            {/* STEP 1: Company Info */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name" className="font-mono text-sm">Nome da Empresa *</Label>
                  <Input
                    id="company_name"
                    placeholder="Ex: Construtora ABC"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="font-mono"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-mono text-sm">Porte da Empresa *</Label>
                  <Select
                    value={formData.company_size}
                    onValueChange={(value) => setFormData({ ...formData, company_size: value })}
                  >
                    <SelectTrigger className="font-mono">
                      <SelectValue placeholder="Selecione o porte" />
                    </SelectTrigger>
                    <SelectContent>
                      {companySizes.map((size) => (
                        <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="font-mono text-sm">Segmento de Atuação *</Label>
                  <Select
                    value={formData.segment}
                    onValueChange={(value) => setFormData({ ...formData, segment: value })}
                  >
                    <SelectTrigger className="font-mono">
                      <SelectValue placeholder="Selecione o segmento" />
                    </SelectTrigger>
                    <SelectContent>
                      {segments.map((seg) => (
                        <SelectItem key={seg.value} value={seg.value}>{seg.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  className="w-full gap-2 rounded-none bg-[#FF6B2C] hover:bg-[#FF6B2C]/90 font-mono text-white"
                  onClick={() => {
                    if (!formData.company_name || !formData.company_size || !formData.segment) {
                      toast.error("Preencha todos os campos obrigatórios");
                      return;
                    }
                    setStep(2);
                  }}
                >
                  Continuar <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* STEP 2: About You */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-mono text-sm">Seu Cargo *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger className="font-mono">
                      <SelectValue placeholder="Selecione seu cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="font-mono text-sm">Telefone/WhatsApp *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="font-mono"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="main_challenge" className="font-mono text-sm">Principal desafio atual (opcional)</Label>
                  <Textarea
                    id="main_challenge"
                    placeholder="Ex: Controlar materiais em múltiplas obras..."
                    value={formData.main_challenge}
                    onChange={(e) => setFormData({ ...formData, main_challenge: e.target.value })}
                    rows={3}
                    className="font-mono"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 font-mono rounded-none"
                    onClick={() => setStep(1)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 gap-2 rounded-none bg-[#FF6B2C] hover:bg-[#FF6B2C]/90 font-mono text-white"
                    onClick={() => {
                      if (!formData.role || !formData.phone) {
                        toast.error("Preencha todos os campos obrigatórios");
                        return;
                      }
                      setStep(3);
                    }}
                  >
                    Continuar <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Platform Tour */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <Rocket className="w-8 h-8 text-[#FF6B2C] mx-auto mb-2" />
                  <p className="text-xs sm:text-sm text-muted-foreground font-mono">
                    Conheça os principais módulos da plataforma
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {tourHighlights.map((item, index) => (
                    <div
                      key={index}
                      className="flex gap-3 p-3 border border-border hover:border-[#FF6B2C]/30 hover:bg-[#FF6B2C]/[0.02] transition-colors"
                    >
                      <div className="w-8 h-8 bg-[#FF6B2C]/10 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-4 h-4 text-[#FF6B2C]" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold font-mono">{item.title}</h3>
                        <p className="text-[10px] sm:text-xs text-muted-foreground font-mono leading-relaxed mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 font-mono rounded-none"
                    onClick={() => setStep(2)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 gap-2 rounded-none bg-[#FF6B2C] hover:bg-[#FF6B2C]/90 font-mono text-white"
                    onClick={() => setStep(4)}
                  >
                    Continuar <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: Finalize */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <CheckCircle2 className="w-10 h-10 text-[#FF6B2C] mx-auto mb-2" />
                  <h2 className="text-base sm:text-lg font-bold font-mono">Quase lá!</h2>
                </div>

                {/* Summary */}
                <div className="bg-muted/30 p-3 sm:p-4 space-y-2 text-sm font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Empresa:</span>
                    <span className="font-medium text-xs">{formData.company_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Segmento:</span>
                    <span className="font-medium text-xs">
                      {segments.find((s) => s.value === formData.segment)?.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Cargo:</span>
                    <span className="font-medium text-xs">
                      {roles.find((r) => r.value === formData.role)?.label}
                    </span>
                  </div>
                </div>

                {/* Demo project toggle */}
                <div
                  className={`p-3 sm:p-4 border cursor-pointer transition-colors ${
                    createDemoProject
                      ? "border-[#FF6B2C]/50 bg-[#FF6B2C]/5"
                      : "border-border"
                  }`}
                  onClick={() => setCreateDemoProject(!createDemoProject)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      createDemoProject ? "border-[#FF6B2C] bg-[#FF6B2C]" : "border-muted-foreground"
                    }`}>
                      {createDemoProject && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold font-mono">Criar Projeto Demonstração</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        Cria um projeto de exemplo para você explorar todas as funcionalidades sem se preocupar com dados reais.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Benefits */}
                <div className="space-y-1.5">
                  {[
                    "30 dias de acesso completo a todos os módulos",
                    "Suporte técnico via email, LinkedIn e WhatsApp",
                    "Dados seguros com criptografia",
                    "Cancele quando quiser, sem compromisso",
                  ].map((benefit, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs sm:text-sm font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#FF6B2C] flex-shrink-0" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 font-mono rounded-none"
                    onClick={() => setStep(3)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 gap-2 rounded-none bg-[#FF6B2C] hover:bg-[#FF6B2C]/90 font-mono text-white"
                    onClick={handleSubmit}
                    disabled={isLoading}
                  >
                    {isLoading ? "Iniciando..." : "Começar Teste Grátis"}
                    {!isLoading && <Rocket className="w-4 h-4" />}
                  </Button>
                </div>

                {/* Support links */}
                <div className="border-t border-border pt-3 mt-3">
                  <p className="text-[10px] font-mono text-muted-foreground text-center mb-2">PRECISA DE AJUDA?</p>
                  <div className="flex justify-center gap-4">
                    <a
                      href="mailto:construdata.contato@gmail.com"
                      className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-[#FF6B2C] transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" /> Email
                    </a>
                    <a
                      href="https://www.linkedin.com/company/construdatasoftware"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-[#FF6B2C] transition-colors"
                    >
                      <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                    </a>
                    <a
                      href="https://wa.me/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-[#FF6B2C] transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-3 sm:mt-4 font-mono">
          Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade.
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
