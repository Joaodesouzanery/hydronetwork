import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Mail, X } from "lucide-react";

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDialog({ open, onOpenChange }: ContactDialogProps) {
  if (!open) return null;

  return (
    <Card className="fixed bottom-6 right-6 w-[380px] shadow-2xl z-50 border-2">
      <CardHeader className="relative pb-3">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-6 w-6"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </Button>
        <CardTitle className="text-lg pr-6">Seja bem-vindo ao ConstruData!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Vamos direto ao ponto. Você está aqui por um motivo — e eu consigo te ajudar mais rápido se você me disser qual é.
        </p>
          
        <div className="space-y-3">
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-sm">O que você precisa agora?</p>
            
            <Button 
              variant="default" 
              className="justify-start gap-2 h-auto py-3"
              asChild
            >
              <a href="https://calendly.com/joaodsouzanery/apresentacao-personalrh" target="_blank" rel="noopener noreferrer">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-semibold">Agendar um atendimento</div>
                  <div className="text-xs opacity-90">Quero falar com alguém e resolver isso de uma vez.</div>
                </div>
              </a>
            </Button>

            <Button 
              variant="outline" 
              className="justify-start gap-2 h-auto py-3"
              asChild
            >
              <a href="mailto:construdata.contato@gmail.com">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-semibold">construdata.contato@gmail.com</div>
                </div>
              </a>
            </Button>
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Email: construdata.contato@gmail.com
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
