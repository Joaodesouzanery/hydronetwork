import { useEffect, useState } from "react";
import {
  CalendarClock, Bell, UserCheck, Users, Save, Trash2,
  AlertTriangle, CheckCircle2, Clock, XCircle, Shield,
  ChevronDown, ChevronUp, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ScheduleConfig {
  id?: string;
  project_id?: string;
  obra_id?: string;
  frequencia: string;
  dias_semana: number[];
  intervalo_dias: number;
  alerta_hora_limite: string;
  alerta_apos_horas: number;
  escalacao_apos_dias: number;
  encarregado_nome: string;
  encarregado_email: string;
  supervisor_nome: string;
  supervisor_email: string;
  ativo: boolean;
}

interface ComplianceEntry {
  id: string;
  data_esperada: string;
  status: string;
  alerta_enviado: boolean;
  escalacao_enviada: boolean;
  justificativa: string | null;
}

const FREQ_OPTIONS = [
  { value: "diario", label: "Diário", desc: "Todos os dias" },
  { value: "dias_uteis", label: "Dias Úteis", desc: "Segunda a sexta" },
  { value: "dia_sim_dia_nao", label: "Dia sim, dia não", desc: "Alternando" },
  { value: "semanal", label: "Semanal", desc: "Dias específicos da semana" },
  { value: "personalizado", label: "Personalizado", desc: "Intervalo em dias" },
];

const DIAS_SEMANA = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

const STATUS_STYLES: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  preenchido: { icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/15", label: "Preenchido" },
  pendente: { icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/15", label: "Pendente" },
  atrasado: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/15", label: "Atrasado" },
  ausente: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/20", label: "Ausente" },
  justificado: { icon: Shield, color: "text-blue-400", bg: "bg-blue-500/15", label: "Justificado" },
};

interface Props {
  projectId?: string;
  obraId?: string;
  projectName?: string;
}

export function RDOScheduleConfig({ projectId, obraId, projectName }: Props) {
  const [config, setConfig] = useState<ScheduleConfig>({
    project_id: projectId,
    obra_id: obraId,
    frequencia: "dias_uteis",
    dias_semana: [1, 2, 3, 4, 5],
    intervalo_dias: 1,
    alerta_hora_limite: "18:00",
    alerta_apos_horas: 2,
    escalacao_apos_dias: 3,
    encarregado_nome: "",
    encarregado_email: "",
    supervisor_nome: "",
    supervisor_email: "",
    ativo: true,
  });

  const [compliance, setCompliance] = useState<ComplianceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showCompliance, setShowCompliance] = useState(true);

  useEffect(() => {
    loadConfig();
  }, [projectId, obraId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("rdo_schedule_config")
        .select("*")
        .eq("ativo", true);

      if (projectId) query = query.eq("project_id", projectId);
      if (obraId) query = query.eq("obra_id", obraId);

      const { data, error } = await query.limit(1).single();

      if (data && !error) {
        setConfig({
          id: data.id,
          project_id: data.project_id,
          obra_id: data.obra_id,
          frequencia: data.frequencia,
          dias_semana: data.dias_semana || [1, 2, 3, 4, 5],
          intervalo_dias: data.intervalo_dias || 1,
          alerta_hora_limite: data.alerta_hora_limite || "18:00",
          alerta_apos_horas: data.alerta_apos_horas || 2,
          escalacao_apos_dias: data.escalacao_apos_dias || 3,
          encarregado_nome: data.encarregado_nome || "",
          encarregado_email: data.encarregado_email || "",
          supervisor_nome: data.supervisor_nome || "",
          supervisor_email: data.supervisor_email || "",
          ativo: data.ativo,
        });

        // Load compliance log
        await loadCompliance(data.id);
      } else {
        setShowConfig(true);
      }
    } catch {
      // No config yet
      setShowConfig(true);
    } finally {
      setLoading(false);
    }
  };

  const loadCompliance = async (scheduleId: string) => {
    const { data } = await supabase
      .from("rdo_compliance_log")
      .select("*")
      .eq("schedule_id", scheduleId)
      .order("data_esperada", { ascending: false })
      .limit(30);

    if (data) setCompliance(data);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado.");
        return;
      }

      const payload = {
        user_id: user.id,
        project_id: projectId || null,
        obra_id: obraId || null,
        frequencia: config.frequencia,
        dias_semana: config.dias_semana,
        intervalo_dias: config.intervalo_dias,
        alerta_hora_limite: config.alerta_hora_limite,
        alerta_apos_horas: config.alerta_apos_horas,
        escalacao_apos_dias: config.escalacao_apos_dias,
        encarregado_nome: config.encarregado_nome || null,
        encarregado_email: config.encarregado_email || null,
        supervisor_nome: config.supervisor_nome || null,
        supervisor_email: config.supervisor_email || null,
        ativo: config.ativo,
      };

      if (config.id) {
        const { error } = await supabase
          .from("rdo_schedule_config")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("rdo_schedule_config")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setConfig(prev => ({ ...prev, id: data.id }));
      }

      toast.success("Agenda de RDO salva com sucesso!");
      setShowConfig(false);
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Erro ao salvar: " + (err.message || "Tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  const handleCheckCompliance = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "check-rdo-compliance"
      );
      if (error) throw error;

      toast.success(
        `Verificação concluída! ${data.checked} registros verificados, ${data.alerts_created} alertas, ${data.escalations_created} escalações.`
      );

      if (config.id) await loadCompliance(config.id);
    } catch (err: any) {
      console.error("Check error:", err);
      toast.error("Erro na verificação: " + (err.message || ""));
    } finally {
      setChecking(false);
    }
  };

  const handleJustify = async (entryId: string) => {
    const justificativa = prompt("Informe a justificativa para ausência de RDO:");
    if (!justificativa) return;

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("rdo_compliance_log")
      .update({
        status: "justificado",
        justificativa,
        justificado_por: user?.id,
        justificado_em: new Date().toISOString(),
      })
      .eq("id", entryId);

    if (error) {
      toast.error("Erro ao justificar");
    } else {
      toast.success("Ausência justificada");
      if (config.id) await loadCompliance(config.id);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split("-");
      return `${d}/${m}/${y}`;
    } catch {
      return dateStr;
    }
  };

  const stats = {
    total: compliance.length,
    preenchidos: compliance.filter(c => c.status === "preenchido").length,
    atrasados: compliance.filter(c => c.status === "atrasado" || c.status === "ausente").length,
    pendentes: compliance.filter(c => c.status === "pendente").length,
    justificados: compliance.filter(c => c.status === "justificado").length,
  };

  const taxaConformidade = stats.total > 0
    ? Math.round(((stats.preenchidos + stats.justificados) / stats.total) * 100)
    : 0;

  if (loading) {
    return (
      <div className="border border-[#1E3A6E] rounded p-4 animate-pulse" style={{ background: "#162044" }}>
        <div className="h-4 bg-[#1E3A6E] rounded w-1/3 mb-3" />
        <div className="h-3 bg-[#1E3A6E] rounded w-1/2" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border border-[#1E3A6E] rounded p-4" style={{ background: "#162044" }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-[#FF6B2C]" />
            <div>
              <h3 className="text-sm font-bold font-mono text-white">
                Controle de RDO {projectName ? `— ${projectName}` : ""}
              </h3>
              <p className="text-[10px] font-mono text-[#64748B]">
                {config.id
                  ? `Frequência: ${FREQ_OPTIONS.find(f => f.value === config.frequencia)?.label || config.frequencia}`
                  : "Nenhuma agenda configurada"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {config.id && (
              <button
                onClick={handleCheckCompliance}
                disabled={checking}
                className="text-[10px] sm:text-xs font-mono px-2.5 py-1.5 rounded border bg-[#3B82F6]/20 text-[#3B82F6] hover:bg-[#3B82F6]/30 border-[#3B82F6]/30 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${checking ? "animate-spin" : ""}`} />
                {checking ? "Verificando..." : "Verificar agora"}
              </button>
            )}
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="text-[10px] sm:text-xs font-mono px-2.5 py-1.5 rounded border bg-[#FF6B2C]/20 text-[#FF6B2C] hover:bg-[#FF6B2C]/30 border-[#FF6B2C]/30 transition-colors flex items-center gap-1"
            >
              {showConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {config.id ? "Editar" : "Configurar"}
            </button>
          </div>
        </div>

        {/* Stats row */}
        {config.id && stats.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
            <div className="text-center p-2 rounded" style={{ background: "#0E1B3D" }}>
              <p className="text-lg font-bold font-mono text-white">{taxaConformidade}%</p>
              <p className="text-[9px] font-mono text-[#64748B]">Conformidade</p>
            </div>
            <div className="text-center p-2 rounded" style={{ background: "#0E1B3D" }}>
              <p className="text-lg font-bold font-mono text-green-400">{stats.preenchidos}</p>
              <p className="text-[9px] font-mono text-[#64748B]">Preenchidos</p>
            </div>
            <div className="text-center p-2 rounded" style={{ background: "#0E1B3D" }}>
              <p className="text-lg font-bold font-mono text-red-400">{stats.atrasados}</p>
              <p className="text-[9px] font-mono text-[#64748B]">Atrasados</p>
            </div>
            <div className="text-center p-2 rounded" style={{ background: "#0E1B3D" }}>
              <p className="text-lg font-bold font-mono text-yellow-400">{stats.pendentes}</p>
              <p className="text-[9px] font-mono text-[#64748B]">Pendentes</p>
            </div>
            <div className="text-center p-2 rounded" style={{ background: "#0E1B3D" }}>
              <p className="text-lg font-bold font-mono text-blue-400">{stats.justificados}</p>
              <p className="text-[9px] font-mono text-[#64748B]">Justificados</p>
            </div>
          </div>
        )}
      </div>

      {/* Configuration form */}
      {showConfig && (
        <div className="border border-[#FF6B2C]/30 rounded p-4 space-y-4" style={{ background: "rgba(255, 107, 44, 0.04)" }}>
          <h4 className="text-xs font-bold font-mono text-[#FF6B2C] flex items-center gap-2">
            <CalendarClock className="w-4 h-4" />
            Configuração da Agenda de RDO
          </h4>

          {/* Frequência */}
          <div>
            <label className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block mb-1.5">
              Frequência de Preenchimento
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {FREQ_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setConfig(prev => ({ ...prev, frequencia: opt.value }))}
                  className={`text-left p-2.5 rounded border transition-all text-xs font-mono ${
                    config.frequencia === opt.value
                      ? "border-[#FF6B2C] bg-[#FF6B2C]/10 text-white"
                      : "border-[#1E3A6E] bg-[#162044] text-[#94A3B8] hover:border-[#FF6B2C]/50"
                  }`}
                >
                  <span className="font-semibold block">{opt.label}</span>
                  <span className="text-[10px] opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dias da semana (para semanal) */}
          {config.frequencia === "semanal" && (
            <div>
              <label className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block mb-1.5">
                Dias da Semana
              </label>
              <div className="flex gap-2 flex-wrap">
                {DIAS_SEMANA.map(dia => (
                  <button
                    key={dia.value}
                    onClick={() => {
                      setConfig(prev => ({
                        ...prev,
                        dias_semana: prev.dias_semana.includes(dia.value)
                          ? prev.dias_semana.filter(d => d !== dia.value)
                          : [...prev.dias_semana, dia.value].sort(),
                      }));
                    }}
                    className={`w-10 h-10 rounded text-xs font-mono font-bold transition-all ${
                      config.dias_semana.includes(dia.value)
                        ? "bg-[#FF6B2C] text-white"
                        : "bg-[#162044] border border-[#1E3A6E] text-[#64748B] hover:border-[#FF6B2C]/50"
                    }`}
                  >
                    {dia.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Intervalo personalizado */}
          {config.frequencia === "personalizado" && (
            <div>
              <label className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block mb-1.5">
                Intervalo (dias)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={config.intervalo_dias}
                onChange={e => setConfig(prev => ({ ...prev, intervalo_dias: parseInt(e.target.value) || 1 }))}
                className="w-24 text-xs font-mono bg-[#162044] border border-[#1E3A6E] rounded text-white px-3 py-2 focus:border-[#FF6B2C]/50 outline-none"
              />
              <span className="text-[10px] font-mono text-[#64748B] ml-2">
                A cada {config.intervalo_dias} dia{config.intervalo_dias > 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Alertas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block mb-1.5">
                <Bell className="w-3 h-3 inline mr-1" />
                Hora limite para RDO
              </label>
              <input
                type="time"
                value={config.alerta_hora_limite}
                onChange={e => setConfig(prev => ({ ...prev, alerta_hora_limite: e.target.value }))}
                className="w-full text-xs font-mono bg-[#162044] border border-[#1E3A6E] rounded text-white px-3 py-2 focus:border-[#FF6B2C]/50 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block mb-1.5">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Alerta após (horas)
              </label>
              <input
                type="number"
                min={1}
                max={24}
                value={config.alerta_apos_horas}
                onChange={e => setConfig(prev => ({ ...prev, alerta_apos_horas: parseInt(e.target.value) || 2 }))}
                className="w-full text-xs font-mono bg-[#162044] border border-[#1E3A6E] rounded text-white px-3 py-2 focus:border-[#FF6B2C]/50 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block mb-1.5">
                <Users className="w-3 h-3 inline mr-1" />
                Escalar após (dias sem RDO)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={config.escalacao_apos_dias}
                onChange={e => setConfig(prev => ({ ...prev, escalacao_apos_dias: parseInt(e.target.value) || 3 }))}
                className="w-full text-xs font-mono bg-[#162044] border border-[#1E3A6E] rounded text-white px-3 py-2 focus:border-[#FF6B2C]/50 outline-none"
              />
            </div>
          </div>

          {/* Hierarquia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block">
                <UserCheck className="w-3 h-3 inline mr-1" />
                Encarregado (Responsável pelo RDO)
              </label>
              <input
                type="text"
                placeholder="Nome do encarregado"
                value={config.encarregado_nome}
                onChange={e => setConfig(prev => ({ ...prev, encarregado_nome: e.target.value }))}
                className="w-full text-xs font-mono bg-[#162044] border border-[#1E3A6E] rounded text-white px-3 py-2 placeholder-[#64748B] focus:border-[#FF6B2C]/50 outline-none"
              />
              <input
                type="email"
                placeholder="email@exemplo.com"
                value={config.encarregado_email}
                onChange={e => setConfig(prev => ({ ...prev, encarregado_email: e.target.value }))}
                className="w-full text-xs font-mono bg-[#162044] border border-[#1E3A6E] rounded text-white px-3 py-2 placeholder-[#64748B] focus:border-[#FF6B2C]/50 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block">
                <Users className="w-3 h-3 inline mr-1" />
                Superior Hierárquico (Recebe escalação)
              </label>
              <input
                type="text"
                placeholder="Nome do supervisor/engenheiro"
                value={config.supervisor_nome}
                onChange={e => setConfig(prev => ({ ...prev, supervisor_nome: e.target.value }))}
                className="w-full text-xs font-mono bg-[#162044] border border-[#1E3A6E] rounded text-white px-3 py-2 placeholder-[#64748B] focus:border-[#FF6B2C]/50 outline-none"
              />
              <input
                type="email"
                placeholder="email@exemplo.com"
                value={config.supervisor_email}
                onChange={e => setConfig(prev => ({ ...prev, supervisor_email: e.target.value }))}
                className="w-full text-xs font-mono bg-[#162044] border border-[#1E3A6E] rounded text-white px-3 py-2 placeholder-[#64748B] focus:border-[#FF6B2C]/50 outline-none"
              />
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs font-mono px-4 py-2 rounded bg-[#FF6B2C] text-white hover:bg-[#FF6B2C]/80 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Salvando..." : config.id ? "Atualizar Agenda" : "Criar Agenda"}
            </button>
            {config.id && (
              <button
                onClick={() => setShowConfig(false)}
                className="text-xs font-mono px-4 py-2 rounded border border-[#1E3A6E] text-[#64748B] hover:text-white transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Compliance Log */}
      {config.id && compliance.length > 0 && (
        <div className="border border-[#1E3A6E] rounded" style={{ background: "#162044" }}>
          <button
            onClick={() => setShowCompliance(!showCompliance)}
            className="w-full flex items-center justify-between p-3 text-left"
          >
            <span className="text-xs font-bold font-mono text-white flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[#3B82F6]" />
              Histórico de Conformidade
              <span className="text-[10px] font-mono text-[#64748B] bg-[#1E3A6E] px-2 py-0.5 rounded">
                {compliance.length} registros
              </span>
            </span>
            {showCompliance ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
          </button>

          {showCompliance && (
            <div className="border-t border-[#1E3A6E]">
              {/* Progress bar */}
              <div className="px-3 py-2">
                <div className="h-2 bg-[#0E1B3D] rounded-full overflow-hidden flex">
                  {stats.total > 0 && (
                    <>
                      <div className="h-full bg-green-500 transition-all" style={{ width: `${(stats.preenchidos / stats.total) * 100}%` }} />
                      <div className="h-full bg-blue-500 transition-all" style={{ width: `${(stats.justificados / stats.total) * 100}%` }} />
                      <div className="h-full bg-yellow-500 transition-all" style={{ width: `${(stats.pendentes / stats.total) * 100}%` }} />
                      <div className="h-full bg-red-500 transition-all" style={{ width: `${(stats.atrasados / stats.total) * 100}%` }} />
                    </>
                  )}
                </div>
              </div>

              {/* Entries */}
              <div className="max-h-80 overflow-y-auto">
                {compliance.map(entry => {
                  const style = STATUS_STYLES[entry.status] || STATUS_STYLES.pendente;
                  const Icon = style.icon;
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 px-3 py-2 border-t border-[#1E3A6E]/50 hover:bg-white/[0.02]"
                    >
                      <span className="text-xs font-mono text-[#94A3B8] w-20 flex-shrink-0">
                        {formatDate(entry.data_esperada)}
                      </span>
                      <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${style.bg} ${style.color}`}>
                        <Icon className="w-3 h-3" />
                        {style.label}
                      </span>
                      {entry.alerta_enviado && (
                        <Bell className="w-3 h-3 text-yellow-400 flex-shrink-0" title="Alerta enviado" />
                      )}
                      {entry.escalacao_enviada && (
                        <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" title="Escalação enviada" />
                      )}
                      {entry.justificativa && (
                        <span className="text-[10px] font-mono text-[#64748B] truncate flex-1" title={entry.justificativa}>
                          {entry.justificativa}
                        </span>
                      )}
                      {(entry.status === "atrasado" || entry.status === "ausente") && !entry.justificativa && (
                        <button
                          onClick={() => handleJustify(entry.id)}
                          className="text-[9px] font-mono text-[#3B82F6] hover:text-[#3B82F6]/80 ml-auto"
                        >
                          Justificar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
