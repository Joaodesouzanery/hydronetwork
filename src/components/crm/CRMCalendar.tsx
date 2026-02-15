import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  ChevronLeft, ChevronRight, Phone, Users, Calendar as CalendarIcon, 
  CheckSquare, Clock, FileText
} from "lucide-react";
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, 
  isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, parseISO,
  isToday, addWeeks, subWeeks
} from "date-fns";
import { ptBR } from "date-fns/locale";

interface Activity {
  id: string;
  activity_type: "task" | "call" | "meeting" | "followup" | "note";
  title: string;
  due_date: string | null;
  due_time: string | null;
  status: "pending" | "completed" | "cancelled";
  contact?: { id: string; full_name: string } | null;
  account?: { id: string; name: string } | null;
  deal?: { id: string; name: string } | null;
}

const ACTIVITY_ICONS = {
  task: CheckSquare,
  call: Phone,
  meeting: Users,
  followup: Clock,
  note: FileText,
};

const ACTIVITY_COLORS = {
  task: "bg-blue-100 text-blue-800 border-blue-200",
  call: "bg-green-100 text-green-800 border-green-200",
  meeting: "bg-purple-100 text-purple-800 border-purple-200",
  followup: "bg-yellow-100 text-yellow-800 border-yellow-200",
  note: "bg-gray-100 text-gray-800 border-gray-200",
};

export const CRMCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<"month" | "week" | "day">("month");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["crm-activities-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_activities")
        .select(`
          *,
          contact:crm_contacts(id, full_name),
          account:crm_accounts(id, name),
          deal:crm_deals(id, name)
        `)
        .not("due_date", "is", null)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data || []) as Activity[];
    },
  });

  const filteredActivities = useMemo(() => {
    if (filterType === "all") return activities;
    return activities.filter(a => a.activity_type === filterType);
  }, [activities, filterType]);

  const getActivitiesForDate = (date: Date) => {
    return filteredActivities.filter(a => 
      a.due_date && isSameDay(parseISO(a.due_date), date)
    );
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const navigatePrevious = () => {
    if (viewType === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (viewType === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(new Date(currentDate.getTime() - 86400000));
    }
  };

  const navigateNext = () => {
    if (viewType === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (viewType === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(new Date(currentDate.getTime() + 86400000));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const renderMonthView = () => (
    <div className="grid grid-cols-7 gap-px bg-muted">
      {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
        <div key={day} className="bg-background p-2 text-center text-sm font-medium text-muted-foreground">
          {day}
        </div>
      ))}
      {calendarDays.map((day) => {
        const dayActivities = getActivitiesForDate(day);
        const isCurrentMonth = isSameMonth(day, currentDate);
        const isSelected = selectedDate && isSameDay(day, selectedDate);

        return (
          <div
            key={day.toISOString()}
            onClick={() => setSelectedDate(day)}
            className={`
              bg-background p-2 min-h-[100px] cursor-pointer transition-colors
              ${!isCurrentMonth ? "opacity-50" : ""}
              ${isToday(day) ? "bg-primary/5" : ""}
              ${isSelected ? "ring-2 ring-primary" : ""}
              hover:bg-muted/50
            `}
          >
            <div className={`
              text-sm font-medium mb-1
              ${isToday(day) ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center" : ""}
            `}>
              {format(day, "d")}
            </div>
            <div className="space-y-1">
              {dayActivities.slice(0, 3).map((activity) => {
                const Icon = ACTIVITY_ICONS[activity.activity_type];
                return (
                  <div
                    key={activity.id}
                    className={`
                      text-xs p-1 rounded truncate flex items-center gap-1
                      ${ACTIVITY_COLORS[activity.activity_type]}
                      ${activity.status === "completed" ? "opacity-50 line-through" : ""}
                    `}
                  >
                    <Icon className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{activity.title}</span>
                  </div>
                );
              })}
              {dayActivities.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{dayActivities.length - 3} mais
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderWeekView = () => (
    <div className="grid grid-cols-7 gap-2">
      {weekDays.map((day) => {
        const dayActivities = getActivitiesForDate(day);
        const isSelected = selectedDate && isSameDay(day, selectedDate);

        return (
          <div
            key={day.toISOString()}
            onClick={() => setSelectedDate(day)}
            className={`
              border rounded-lg p-3 min-h-[300px] cursor-pointer transition-colors
              ${isToday(day) ? "border-primary bg-primary/5" : ""}
              ${isSelected ? "ring-2 ring-primary" : ""}
              hover:bg-muted/50
            `}
          >
            <div className="text-center mb-3">
              <div className="text-sm text-muted-foreground">
                {format(day, "EEE", { locale: ptBR })}
              </div>
              <div className={`
                text-lg font-semibold
                ${isToday(day) ? "bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center mx-auto" : ""}
              `}>
                {format(day, "d")}
              </div>
            </div>
            <div className="space-y-2">
              {dayActivities.map((activity) => {
                const Icon = ACTIVITY_ICONS[activity.activity_type];
                return (
                  <div
                    key={activity.id}
                    className={`
                      text-xs p-2 rounded border
                      ${ACTIVITY_COLORS[activity.activity_type]}
                      ${activity.status === "completed" ? "opacity-50" : ""}
                    `}
                  >
                    <div className="flex items-center gap-1 font-medium">
                      <Icon className="h-3 w-3" />
                      {activity.due_time && (
                        <span>{activity.due_time.slice(0, 5)}</span>
                      )}
                    </div>
                    <p className={activity.status === "completed" ? "line-through" : ""}>
                      {activity.title}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderDayView = () => {
    const dayActivities = getActivitiesForDate(currentDate);

    return (
      <div className="space-y-4">
        <div className="text-center py-4">
          <h3 className="text-xl font-semibold">
            {format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h3>
        </div>
        {dayActivities.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma atividade para este dia
          </div>
        ) : (
          <div className="space-y-3">
            {dayActivities.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.activity_type];
              return (
                <Card key={activity.id} className={activity.status === "completed" ? "opacity-60" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded ${ACTIVITY_COLORS[activity.activity_type]}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className={`font-medium ${activity.status === "completed" ? "line-through" : ""}`}>
                            {activity.title}
                          </h4>
                          {activity.due_time && (
                            <Badge variant="outline">
                              {activity.due_time.slice(0, 5)}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground space-y-1">
                          {activity.contact && <p>Contato: {activity.contact.full_name}</p>}
                          {activity.account && <p>Empresa: {activity.account.name}</p>}
                          {activity.deal && <p>Oportunidade: {activity.deal.name}</p>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const selectedDateActivities = selectedDate ? getActivitiesForDate(selectedDate) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={navigatePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={goToToday}>
            Hoje
          </Button>
          <h2 className="text-lg font-semibold ml-2">
            {viewType === "month" && format(currentDate, "MMMM yyyy", { locale: ptBR })}
            {viewType === "week" && `${format(weekStart, "d")} - ${format(weekEnd, "d 'de' MMMM", { locale: ptBR })}`}
            {viewType === "day" && format(currentDate, "d 'de' MMMM yyyy", { locale: ptBR })}
          </h2>
        </div>
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filtrar tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="task">Tarefas</SelectItem>
              <SelectItem value="call">Ligações</SelectItem>
              <SelectItem value="meeting">Reuniões</SelectItem>
              <SelectItem value="followup">Follow-ups</SelectItem>
              <SelectItem value="note">Notas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={viewType} onValueChange={(v: any) => setViewType(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mês</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="day">Dia</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : (
                <>
                  {viewType === "month" && renderMonthView()}
                  {viewType === "week" && renderWeekView()}
                  {viewType === "day" && renderDayView()}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {selectedDate 
                  ? format(selectedDate, "d 'de' MMMM", { locale: ptBR })
                  : "Selecione um dia"
                }
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDate ? (
                selectedDateActivities.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDateActivities.map((activity) => {
                      const Icon = ACTIVITY_ICONS[activity.activity_type];
                      return (
                        <div
                          key={activity.id}
                          className={`
                            p-2 rounded border text-sm
                            ${ACTIVITY_COLORS[activity.activity_type]}
                            ${activity.status === "completed" ? "opacity-60" : ""}
                          `}
                        >
                          <div className="flex items-center gap-1 font-medium">
                            <Icon className="h-3 w-3" />
                            {activity.due_time && activity.due_time.slice(0, 5)}
                          </div>
                          <p className={activity.status === "completed" ? "line-through" : ""}>
                            {activity.title}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma atividade
                  </p>
                )
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Clique em um dia para ver as atividades
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
