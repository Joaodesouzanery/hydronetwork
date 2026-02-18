import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SatisfactionToastProps {
  question: string;
  triggerEvent: string;
  moduleContext?: string;
  onClose: () => void;
}

const emojis = [
  { key: "very_sad", emoji: "😡", label: "Muito insatisfeito" },
  { key: "sad", emoji: "😞", label: "Insatisfeito" },
  { key: "neutral", emoji: "😐", label: "Neutro" },
  { key: "happy", emoji: "😊", label: "Satisfeito" },
  { key: "very_happy", emoji: "🤩", label: "Muito satisfeito" },
];

export function SatisfactionToast({ question, triggerEvent, moduleContext, onClose }: SatisfactionToastProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = async (emoji: string) => {
    setSelected(emoji);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("user_feedback").insert({
          user_id: user.id,
          feedback_type: "micro_survey",
          trigger_event: triggerEvent,
          emoji_rating: emoji,
          question,
          module_context: moduleContext,
          page_context: window.location.pathname,
        });
      }
    } catch {}
    setTimeout(onClose, 1500);
  };

  return (
    <div className="fixed top-20 right-6 z-50 w-80 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug">{question}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {selected ? (
          <p className="text-xs text-emerald-600 font-medium mt-3">Obrigado pelo seu feedback! ✓</p>
        ) : (
          <div className="flex gap-2 mt-3 justify-center">
            {emojis.map((e) => (
              <button
                key={e.key}
                onClick={() => handleSelect(e.key)}
                className="text-2xl hover:scale-125 transition-transform"
                title={e.label}
              >
                {e.emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
