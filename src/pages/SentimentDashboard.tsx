import { useState, useMemo } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Smile, Frown, Meh, TrendingUp, MessageSquare, Star, Users, FileText } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const emojiMap: Record<string, { emoji: string; value: number; label: string }> = {
  very_happy: { emoji: "🤩", value: 5, label: "Muito Satisfeito" },
  happy: { emoji: "😊", value: 4, label: "Satisfeito" },
  neutral: { emoji: "😐", value: 3, label: "Neutro" },
  sad: { emoji: "😞", value: 2, label: "Insatisfeito" },
  very_sad: { emoji: "😡", value: 1, label: "Muito Insatisfeito" },
};

const SentimentDashboard = () => {
  const [days, setDays] = useState(7);

  const { data: feedback = [] } = useQuery({
    queryKey: ["admin-feedback", days],
    queryFn: async () => {
      const since = subDays(new Date(), days).toISOString();
      const { data, error } = await supabase
        .from("user_feedback")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const withEmoji = feedback.filter(f => f.emoji_rating);
    const avgScore = withEmoji.length > 0
      ? withEmoji.reduce((sum, f) => sum + (emojiMap[f.emoji_rating!]?.value || 3), 0) / withEmoji.length
      : 0;

    const textFeedback = feedback.filter(f => f.text_response);
    const promoters = withEmoji.filter(f => (emojiMap[f.emoji_rating!]?.value || 0) >= 4);
    const detractors = withEmoji.filter(f => (emojiMap[f.emoji_rating!]?.value || 0) <= 2);

    // Count emoji distribution
    const emojiDist: Record<string, number> = {};
    withEmoji.forEach(f => {
      emojiDist[f.emoji_rating!] = (emojiDist[f.emoji_rating!] || 0) + 1;
    });

    // Word frequency from text feedback
    const wordFreq: Record<string, number> = {};
    textFeedback.forEach(f => {
      const words = (f.text_response || "").toLowerCase().split(/\s+/).filter(w => w.length > 4);
      words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
    });
    const topWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 10);

    return { avgScore, total: feedback.length, withEmoji: withEmoji.length, textFeedback: textFeedback.length, promoters: promoters.length, detractors: detractors.length, emojiDist, topWords };
  }, [feedback]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1">
          <div className="flex items-center gap-2 border-b px-4 py-3 bg-background/95 backdrop-blur sticky top-0 z-10">
            <SidebarTrigger />
            <h1 className="text-xl font-semibold font-mono">Dashboard de Sentimento</h1>
            <div className="ml-auto flex gap-2">
              {[7, 14, 30].map(d => (
                <button key={d} onClick={() => setDays(d)} className={`px-3 py-1 rounded-none text-xs font-medium transition-colors ${days === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                  {d}d
                </button>
              ))}
            </div>
          </div>

          <main className="flex-1 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* KPI cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-none bg-primary/10 flex items-center justify-center">
                      <Smile className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-black">{stats.avgScore.toFixed(1)}<span className="text-sm text-muted-foreground font-normal">/5</span></p>
                      <p className="text-xs text-muted-foreground">Índice de Felicidade</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-none bg-emerald-500/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-black">{stats.promoters}</p>
                      <p className="text-xs text-muted-foreground">Promotores</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-none bg-destructive/10 flex items-center justify-center">
                      <Frown className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-2xl font-black">{stats.detractors}</p>
                      <p className="text-xs text-muted-foreground">Detratores</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-none bg-amber-500/10 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-black">{stats.total}</p>
                      <p className="text-xs text-muted-foreground">Total de Feedbacks</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Emoji distribution */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Distribuição de Reações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(emojiMap).map(([key, { emoji, label }]) => {
                        const count = stats.emojiDist[key] || 0;
                        const pct = stats.withEmoji > 0 ? (count / stats.withEmoji) * 100 : 0;
                        return (
                          <div key={key} className="flex items-center gap-3">
                            <span className="text-xl w-8">{emoji}</span>
                            <span className="text-xs w-32 text-muted-foreground">{label}</span>
                            <div className="flex-1 h-6 bg-muted overflow-hidden">
                              <div className="h-full bg-primary/60 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-bold w-10 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Top words */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Top Palavras (Feedback Aberto)</CardTitle>
                    <CardDescription>Palavras mais mencionadas nos feedbacks de texto</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {stats.topWords.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Nenhum feedback de texto no período.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {stats.topWords.map(([word, count]) => (
                          <span key={word} className="px-3 py-1.5 bg-muted text-sm font-medium">
                            {word} <span className="text-xs text-muted-foreground ml-1">({count})</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recent feedback */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Feedbacks Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  {feedback.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum feedback no período selecionado.</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {feedback.slice(0, 50).map((f) => (
                        <div key={f.id} className="flex items-start gap-3 p-3 rounded-none bg-muted/30 border border-border/50">
                          <span className="text-xl">
                            {f.emoji_rating ? emojiMap[f.emoji_rating]?.emoji || <FileText className="h-5 w-5 inline-block" /> : <FileText className="h-5 w-5 inline-block" />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">{f.feedback_type}</span>
                              {f.trigger_event && <span className="text-xs text-muted-foreground">{f.trigger_event}</span>}
                              {f.module_context && <span className="text-xs text-muted-foreground">• {f.module_context}</span>}
                            </div>
                            {f.question && <p className="text-xs text-muted-foreground italic mb-1">"{f.question}"</p>}
                            {f.text_response && <p className="text-sm">{f.text_response}</p>}
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {format(new Date(f.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              {f.page_context && ` • ${f.page_context}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default SentimentDashboard;
