import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePendingSurvey } from "@/hooks/usePendingSurvey";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, X } from "lucide-react";
import { toast } from "sonner";

export function SurveyNotification() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: pendingSurvey } = usePendingSurvey();
  const [dismissed, setDismissed] = useState(false);

  const dismissMutation = useMutation({
    mutationFn: async (dispatchId: string) => {
      const { error } = await supabase
        .from("survey_dispatches")
        .update({
          is_dismissed: true,
          dismissed_at: new Date().toISOString(),
        })
        .eq("id", dispatchId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-survey-dispatch"] });
      setDismissed(true);
      toast.info("Pesquisa dispensada. Você pode responder depois.");
    },
    onError: () => {
      toast.error("Erro ao dispensar pesquisa");
    },
  });

  if (!pendingSurvey || dismissed) {
    return null;
  }

  return (
    <Card className="mb-6 border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Pesquisa de Satisfação</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => dismissMutation.mutate(pendingSurvey.id)}
            disabled={dismissMutation.isPending}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Sua opinião é importante! Responda nossa pesquisa de satisfação e ajude a melhorar o ConstruData.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <Button
          onClick={() => navigate(`/satisfaction-survey?dispatch=${pendingSurvey.id}`)}
          className="w-full sm:w-auto"
        >
          <ClipboardCheck className="h-4 w-4 mr-2" />
          Responder Pesquisa (3-5 min)
        </Button>
      </CardContent>
    </Card>
  );
}
