import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

const functionalities = [
  { id: "rdo", label: "🏗 Gestão de Obras / Diário de Obra (RDO)" },
  { id: "materials", label: "📦 Controle de Materiais & Almoxarifado" },
  { id: "checklists", label: "📝 Checklists & Qualidade" },
  { id: "teams", label: "👷 Equipes e Folha de Campo" },
  { id: "maintenance", label: "🛠 Manutenção Predial / Ativos" },
  { id: "budget", label: "💰 Orçamento & Custos" },
  { id: "dashboard", label: "📊 Dashboard e Indicadores" },
  { id: "automation", label: "🔄 Automação de Fluxos (Workflows)" },
];

const employeeSizes = [
  "1–10",
  "11–25",
  "26–50",
  "51–100",
  "101–200",
  "200+",
];

const projectsPerYear = [
  "1–3",
  "4–10",
  "11–20",
  "20+",
];

export default function SystemTest() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    functionalities: [] as string[],
    employeeSize: "",
    projectsPerYear: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    position: "",
    company: "",
    state: "",
  });

  const handleFunctionalityToggle = (id: string) => {
    setFormData(prev => ({
      ...prev,
      functionalities: prev.functionalities.includes(id)
        ? prev.functionalities.filter(f => f !== id)
        : [...prev.functionalities, id]
    }));
  };

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(4);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => step === 1 ? navigate("/") : handleBack()}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        {/* Step 1: Funcionalidades */}
        {step === 1 && (
          <Card className="animate-fade-in">
            <CardHeader className="text-center space-y-4">
              <CardTitle className="text-3xl font-bold">
                Economize tempo, reduza custos e ganhe controle total da sua obra — tudo em um único sistema.
              </CardTitle>
              <p className="text-lg text-muted-foreground">
                A plataforma completa para gestão de obras, materiais, equipes, manutenção e orçamento — tudo integrado, simples e rápido.
              </p>
              <Button size="lg" onClick={handleNext} className="mt-4">
                Agende uma demonstração personalizada
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-4">Como podemos ajudar sua empresa hoje?</h3>
                <p className="text-sm text-muted-foreground mb-4">Selecione todas as funcionalidades que interessam:</p>
                <div className="grid gap-3">
                  {functionalities.map((func) => (
                    <div key={func.id} className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
                      <Checkbox
                        id={func.id}
                        checked={formData.functionalities.includes(func.id)}
                        onCheckedChange={() => handleFunctionalityToggle(func.id)}
                      />
                      <Label htmlFor={func.id} className="cursor-pointer flex-1 text-base">
                        {func.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={handleNext} className="w-full" size="lg" disabled={formData.functionalities.length === 0}>
                Próximo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Estrutura da Empresa */}
        {step === 2 && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="text-2xl">Conte-nos sobre sua empresa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Quantos funcionários ou colaboradores sua empresa possui?</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {employeeSizes.map((size) => (
                    <Button
                      key={size}
                      variant={formData.employeeSize === size ? "default" : "outline"}
                      onClick={() => setFormData(prev => ({ ...prev, employeeSize: size }))}
                      className="h-20 text-lg"
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Quantas obras vocês executam por ano?</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {projectsPerYear.map((projects) => (
                    <Button
                      key={projects}
                      variant={formData.projectsPerYear === projects ? "default" : "outline"}
                      onClick={() => setFormData(prev => ({ ...prev, projectsPerYear: projects }))}
                      className="h-20 text-lg"
                    >
                      {projects}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleBack} variant="outline" className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Button onClick={handleNext} className="flex-1" disabled={!formData.employeeSize || !formData.projectsPerYear}>
                  Próximo <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Formulário de Cadastro */}
        {step === 3 && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="text-2xl">Perfeito! Seu perfil indica que nossa plataforma é uma ótima solução para sua empresa.</CardTitle>
              <p className="text-muted-foreground">Preencha seus dados para receber sua demonstração personalizada:</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Primeiro Nome *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Sobrenome *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Corporativo *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Celular / WhatsApp *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="position">Cargo *</Label>
                    <Input
                      id="position"
                      value={formData.position}
                      onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Nome da Empresa *</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">Estado *</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" onClick={handleBack} variant="outline" className="flex-1">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                  </Button>
                  <Button type="submit" className="flex-1">
                    Quero Agendar Minha Demo
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Calendly */}
        {step === 4 && (
          <Card className="animate-fade-in">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Agende sua call de diagnóstico e receba uma demonstração completa</CardTitle>
              <p className="text-muted-foreground">
                Uma conversa rápida (15 min) para entendermos suas necessidades e mostrar como podemos reduzir custos, eliminar retrabalho e melhorar o controle da sua obra.
              </p>
            </CardHeader>
            <CardContent>
              <div className="relative w-full" style={{ minHeight: "700px" }}>
                <iframe
                  src="https://calendly.com/joaodsouzanery/apresentacao-personalrh"
                  width="100%"
                  height="700"
                  frameBorder="0"
                  title="Agendar Demonstração"
                  className="rounded-lg"
                />
              </div>
              <div className="flex justify-center mt-4">
                <Button onClick={() => setStep(5)} variant="outline">
                  Continuar para confirmação
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Confirmação */}
        {step === 5 && (
          <Card className="animate-fade-in text-center">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
              <CardTitle className="text-3xl">Obrigado pelo interesse! Sua demonstração está confirmada.</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-lg text-muted-foreground">
                Fique de olho no seu email — enviamos a confirmação do agendamento e os próximos passos.<br />
                Nos vemos na call!
              </p>
              <Button onClick={() => navigate("/")} size="lg">
                Voltar para a Página Inicial
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
