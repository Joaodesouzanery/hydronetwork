import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Support = () => {
  const { toast } = useToast();

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("construdata.contato@gmail.com");
    toast({
      title: "Email copiado!",
      description: "O endereço de email foi copiado para a área de transferência.",
    });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1">
          <div className="flex items-center gap-2 border-b px-4 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
            <SidebarTrigger />
            <h1 className="text-xl font-semibold">Suporte</h1>
          </div>

          <main className="flex-1 p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Fale com o Suporte
                  </CardTitle>
                  <CardDescription>
                    Entre em contato conosco através do email abaixo. Nossa equipe responderá em breve.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center gap-4 p-6 bg-muted rounded-lg">
                    <Mail className="h-12 w-12 text-primary" />
                    <div className="text-center space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Email de contato:
                      </p>
                      <p className="text-2xl font-semibold">
                        construdata.contato@gmail.com
                      </p>
                    </div>
                    <Button
                      onClick={handleCopyEmail}
                      className="gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar Email
                    </Button>
                  </div>

                  <div className="text-center text-sm text-muted-foreground">
                    <p>Envie suas dúvidas, sugestões ou reporte problemas.</p>
                    <p>Responderemos o mais breve possível!</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Support;
