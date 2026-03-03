import { useState } from "react";
import { MessageSquare, X, Send, Bug, Lightbulb, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"bug" | "idea" | "general">("general");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Fallback: send via email
        window.open(`mailto:construdata.contato@gmail.com?subject=Feedback: ${feedbackType}&body=${encodeURIComponent(text)}`, '_blank');
        toast.success("Redirecionando para envio por email...");
      } else {
        const { error } = await supabase.from("user_feedback").insert({
          user_id: user.id,
          feedback_type: feedbackType,
          text_response: text,
          page_context: window.location.pathname,
        });
        if (error) throw error;
        toast.success("Feedback enviado! Obrigado pela sua contribuição.");
      }
      setText("");
      setIsOpen(false);
    } catch {
      toast.error("Erro ao enviar feedback. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  const types = [
    { key: "bug" as const, icon: Bug, label: "Bug" },
    { key: "idea" as const, icon: Lightbulb, label: "Ideia" },
    { key: "general" as const, icon: MessageSquare, label: "Geral" },
  ];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-[#FF6B2C] text-white transition-all hover:bg-[#FF6B2C]/90 flex items-center justify-center"
        title="Enviar feedback"
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
      </button>

      {/* Popup */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-80 bg-card border border-border overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="p-4 bg-[#FF6B2C]/5 border-b border-border">
            <h3 className="font-bold text-sm font-mono">Encontrou algo errado ou tem uma ideia?</h3>
            <p className="text-xs text-muted-foreground font-mono mt-1">Conte para nós!</p>
          </div>

          <div className="p-4 space-y-3">
            {/* Type selector */}
            <div className="flex gap-2">
              {types.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setFeedbackType(t.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium font-mono transition-colors border ${
                    feedbackType === t.key
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Text input */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                feedbackType === "bug"
                  ? "Descreva o problema encontrado..."
                  : feedbackType === "idea"
                  ? "Qual funcionalidade você gostaria de ver?"
                  : "Seu feedback..."
              }
              className="w-full p-3 border border-border bg-background text-sm font-mono resize-none h-24 focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/50 placeholder:text-muted-foreground"
            />

            <Button
              size="sm"
              className="w-full"
              disabled={!text.trim() || sending}
              onClick={handleSubmit}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {sending ? "Enviando..." : "Enviar Feedback"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
