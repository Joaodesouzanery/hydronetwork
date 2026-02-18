import { useState, useCallback, useEffect } from "react";

interface MicroSurveyState {
  visible: boolean;
  question: string;
  triggerEvent: string;
  moduleContext?: string;
}

const dailyQuestions: Record<number, { question: string; triggerEvent: string }> = {
  1: { question: "Como você avalia a velocidade do sistema hoje?", triggerEvent: "performance_check" },
  3: { question: "Qual funcionalidade você mais gostaria de ver melhorada?", triggerEvent: "feature_suggestion" },
  5: { question: "Os tutoriais e documentação foram úteis esta semana?", triggerEvent: "docs_feedback" },
};

export function useMicroSurvey() {
  const [survey, setSurvey] = useState<MicroSurveyState>({
    visible: false,
    question: "",
    triggerEvent: "",
  });

  const showSurvey = useCallback((question: string, triggerEvent: string, moduleContext?: string) => {
    // Check rate limiting (max 1x per day per type)
    const key = `survey_${triggerEvent}_${new Date().toDateString()}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");

    setSurvey({ visible: true, question, triggerEvent, moduleContext });
  }, []);

  const closeSurvey = useCallback(() => {
    setSurvey(prev => ({ ...prev, visible: false }));
  }, []);

  // Trigger post-task surveys
  const triggerCalculationComplete = useCallback(() => {
    showSurvey("O resultado do cálculo foi o esperado?", "calculation_complete");
  }, [showSurvey]);

  const triggerExportComplete = useCallback(() => {
    showSurvey("Quão fácil foi gerar este arquivo? (1-5)", "export_file");
  }, [showSurvey]);

  const triggerNewModuleUse = useCallback((moduleName: string) => {
    showSurvey(`O módulo "${moduleName}" resolveu seu problema?`, "new_module", moduleName);
  }, [showSurvey]);

  // Session-based survey (15% chance on component mount)
  useEffect(() => {
    const dayOfWeek = new Date().getDay();
    const dailyQ = dailyQuestions[dayOfWeek];
    if (!dailyQ) return;

    if (Math.random() > 0.15) return; // 15% chance

    const timer = setTimeout(() => {
      showSurvey(dailyQ.question, dailyQ.triggerEvent);
    }, 60000); // After 1 minute

    return () => clearTimeout(timer);
  }, [showSurvey]);

  return {
    survey,
    closeSurvey,
    triggerCalculationComplete,
    triggerExportComplete,
    triggerNewModuleUse,
  };
}
