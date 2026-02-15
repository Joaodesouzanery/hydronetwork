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
import { Building2, ArrowRight, CheckCircle2 } from "lucide-react";
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

const Onboarding = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
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

      // Check if user already completed onboarding
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      // Calculate trial end date (30 days from now)
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

      toast.success("Bem-vindo ao ConstruData! Seu teste grátis de 30 dias começou.");
      navigate('/dashboard');
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast.error("Erro ao salvar informações. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const benefits = [
    "Acesso completo a todos os 26 módulos",
    "Suporte técnico prioritário",
    "Dados seguros com criptografia",
    "Sem compromisso, cancele quando quiser",
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 text-primary mb-3">
            <Building2 className="w-8 h-8" />
            <span className="text-2xl font-bold">ConstruData</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">Comece seu Teste Grátis</h1>
          <p className="text-muted-foreground text-sm mt-1">30 dias de acesso completo</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span>Etapa {step} de 2</span>
              <span className="text-primary font-medium">
                {step === 1 ? "Sua Empresa" : "Finalizar"}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: step === 1 ? "50%" : "100%" }}
              />
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Nome da Empresa *</Label>
                    <Input
                      id="company_name"
                      placeholder="Ex: Construtora ABC"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company_size">Porte da Empresa *</Label>
                    <Select
                      value={formData.company_size}
                      onValueChange={(value) => setFormData({ ...formData, company_size: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o porte" />
                      </SelectTrigger>
                      <SelectContent>
                        {companySizes.map((size) => (
                          <SelectItem key={size.value} value={size.value}>
                            {size.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="segment">Segmento de Atuação *</Label>
                    <Select
                      value={formData.segment}
                      onValueChange={(value) => setFormData({ ...formData, segment: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o segmento" />
                      </SelectTrigger>
                      <SelectContent>
                        {segments.map((seg) => (
                          <SelectItem key={seg.value} value={seg.value}>
                            {seg.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="button"
                    className="w-full gap-2"
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
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="role">Seu Cargo *</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData({ ...formData, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione seu cargo" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone/WhatsApp *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="main_challenge">Principal desafio atual (opcional)</Label>
                    <Textarea
                      id="main_challenge"
                      placeholder="Ex: Controlar materiais em múltiplas obras..."
                      value={formData.main_challenge}
                      onChange={(e) => setFormData({ ...formData, main_challenge: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <p className="font-semibold text-sm">O que você terá acesso:</p>
                    {benefits.map((benefit, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setStep(1)}
                    >
                      Voltar
                    </Button>
                    <Button type="submit" className="flex-1" disabled={isLoading}>
                      {isLoading ? "Iniciando..." : "Começar Teste Grátis"}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade.
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
