import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Filter } from "lucide-react";
import {
  RDO, ExecutedService, SegmentProgress, ServiceUnit, RDOStatus, SystemType,
  generateId, saveRDOs, validateRDO,
} from "@/engine/rdo";
import { useState, useMemo } from "react";

type ClimaCond = "bom" | "nublado" | "chuva" | "impraticavel";

interface RDOFormCompleteProps {
  rdos: RDO[];
  setRdos: (rdos: RDO[]) => void;
  trechos?: import("@/engine/domain").Trecho[];
  onComplete: () => void;
}

export const RDOFormComplete = ({ rdos, setRdos, trechos = [], onComplete }: RDOFormCompleteProps) => {
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    projectName: "",
    responsavel: "",
    // Climate
    climaManha: "bom" as ClimaCond,
    climaTarde: "bom" as ClimaCond,
    climaNoite: "bom" as ClimaCond,
    temperatura: 25,
    // Workforce
    encarregado: 1,
    oficial: 2,
    ajudante: 4,
    operador: 1,
    // Equipment
    equipamentos: [
      { nome: "Retroescavadeira", quantidade: 1, horas: 8 },
      { nome: "Compactador", quantidade: 1, horas: 6 },
      { nome: "Caminhão", quantidade: 0, horas: 0 },
    ],
    // Services
    services: [] as ExecutedService[],
    // Segments
    segments: [] as SegmentProgress[],
    // Geolocation
    lat: "",
    lng: "",
    // Notes
    notes: "",
    occurrences: "",
  });

  const climaOptions: { value: ClimaCond; label: string }[] = [
    { value: "bom", label: "☀️ Bom" },
    { value: "nublado", label: "☁️ Nublado" },
    { value: "chuva", label: "🌧️ Chuva" },
    { value: "impraticavel", label: "⛈️ Impraticável" },
  ];

  const addService = () => {
    setForm(p => ({
      ...p,
      services: [...p.services, { id: generateId(), serviceName: "", quantity: 0, unit: "m" as ServiceUnit }],
    }));
  };

  const addSegment = () => {
    setForm(p => ({
      ...p,
      segments: [...p.segments, {
        id: generateId(), segmentName: "", system: "esgoto" as SystemType,
        plannedTotal: 0, executedBefore: 0, executedToday: 0,
      }],
    }));
  };

  const handleGetGPS = () => {
    if (!navigator.geolocation) {
      toast.error("GPS não disponível.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(p => ({ ...p, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }));
        toast.success("Coordenadas obtidas!");
      },
      () => toast.error("Erro ao obter GPS.")
    );
  };

  const handleSave = (status: RDOStatus) => {
    const rdo: RDO = {
      id: generateId(),
      projectId: "default",
      date: form.date,
      projectName: form.projectName || "Projeto HydroNetwork",
      status,
      services: form.services,
      segments: form.segments,
      notes: form.notes,
      occurrences: form.occurrences,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const validation = validateRDO(rdo);
    if (!validation.valid) {
      validation.errors.forEach(e => toast.error(e));
      return;
    }

    const updated = [...rdos, rdo];
    setRdos(updated);
    saveRDOs(updated);
    toast.success(`RDO ${status === "rascunho" ? "salvo como rascunho" : "enviado"}!`);
    onComplete();
  };

  return (
    <div className="space-y-4">
      {/* 1. Informações Gerais */}
      <Card>
        <CardHeader><CardTitle>📋 1. Informações Gerais</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Data do Relatório</Label>
            <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          </div>
          <div>
            <Label>Nº do RDO</Label>
            <Input value={`RDO-${String(rdos.length + 1).padStart(3, "0")}`} disabled />
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={form.responsavel} onChange={e => setForm(p => ({ ...p, responsavel: e.target.value }))} placeholder="Nome do responsável" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Condições Climáticas */}
      <Card>
        <CardHeader><CardTitle>🌤️ 2. Condições Climáticas</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Manhã", key: "climaManha" as const },
            { label: "Tarde", key: "climaTarde" as const },
            { label: "Noite", key: "climaNoite" as const },
          ].map(({ label, key }) => (
            <div key={key}>
              <Label>{label}</Label>
              <Select value={form[key]} onValueChange={(v) => setForm(p => ({ ...p, [key]: v as ClimaCond }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {climaOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <div>
            <Label>Temperatura (°C)</Label>
            <Input type="number" value={form.temperatura} onChange={e => setForm(p => ({ ...p, temperatura: Number(e.target.value) }))} />
          </div>
        </CardContent>
      </Card>

      {/* 3. Efetivo */}
      <Card>
        <CardHeader><CardTitle>👷 3. Mão de Obra</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Encarregado", key: "encarregado" as const },
              { label: "Oficial", key: "oficial" as const },
              { label: "Ajudante", key: "ajudante" as const },
              { label: "Operador", key: "operador" as const },
            ].map(({ label, key }) => (
              <div key={key}>
                <Label>{label}</Label>
                <Input type="number" min={0} value={form[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: Number(e.target.value) }))} />
              </div>
            ))}
          </div>
          <Badge variant="outline" className="mt-3">
            Total: {form.encarregado + form.oficial + form.ajudante + form.operador} pessoas
          </Badge>
        </CardContent>
      </Card>

      {/* 4. Equipamentos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>🚜 4. Equipamentos</CardTitle>
          <Button size="sm" variant="outline" onClick={() => {
            setForm(p => ({
              ...p,
              equipamentos: [...p.equipamentos, { nome: "", quantidade: 1, horas: 8 }],
            }));
          }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Equipamento
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {form.equipamentos.map((eq, idx) => (
              <div key={idx} className="grid grid-cols-4 gap-3 items-end">
                <div>
                  <Label className="text-xs">Equipamento</Label>
                  <Input
                    value={eq.nome}
                    onChange={e => {
                      const eqs = [...form.equipamentos];
                      eqs[idx] = { ...eqs[idx], nome: e.target.value };
                      setForm(p => ({ ...p, equipamentos: eqs }));
                    }}
                    placeholder="Nome do equipamento"
                  />
                </div>
                <div>
                  <Label className="text-xs">Quantidade</Label>
                  <Input type="number" min={0} value={eq.quantidade}
                    onChange={e => {
                      const eqs = [...form.equipamentos];
                      eqs[idx] = { ...eqs[idx], quantidade: Number(e.target.value) };
                      setForm(p => ({ ...p, equipamentos: eqs }));
                    }} />
                </div>
                <div>
                  <Label className="text-xs">Horas</Label>
                  <Input type="number" min={0} value={eq.horas}
                    onChange={e => {
                      const eqs = [...form.equipamentos];
                      eqs[idx] = { ...eqs[idx], horas: Number(e.target.value) };
                      setForm(p => ({ ...p, equipamentos: eqs }));
                    }} />
                </div>
                <div>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                    setForm(p => ({ ...p, equipamentos: p.equipamentos.filter((_, i) => i !== idx) }));
                  }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {form.equipamentos.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum equipamento. Clique em "Adicionar Equipamento" acima.
            </p>
          )}
          <Badge variant="outline" className="mt-3">
            Total: {form.equipamentos.reduce((s, eq) => s + eq.quantidade, 0)} equipamentos,{" "}
            {form.equipamentos.reduce((s, eq) => s + eq.quantidade * eq.horas, 0)} horas-máquina
          </Badge>
        </CardContent>
      </Card>

      {/* 5. Serviços Executados */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>🔧 5. Serviços Executados</CardTitle>
          <Button size="sm" variant="outline" onClick={addService}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.services.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum serviço adicionado.</p>}
          {form.services.map((svc, idx) => (
            <div key={svc.id} className="flex gap-2 items-end">
              <div className="flex-1">
                <Input placeholder="Nome do serviço" value={svc.serviceName}
                  onChange={e => {
                    const s = [...form.services];
                    s[idx] = { ...s[idx], serviceName: e.target.value };
                    setForm(p => ({ ...p, services: s }));
                  }} />
              </div>
              <div className="w-20">
                <Input type="number" placeholder="Qtd" value={svc.quantity || ""}
                  onChange={e => {
                    const s = [...form.services];
                    s[idx] = { ...s[idx], quantity: Number(e.target.value) };
                    setForm(p => ({ ...p, services: s }));
                  }} />
              </div>
              <div className="w-20">
                <Select value={svc.unit} onValueChange={v => {
                  const s = [...form.services];
                  s[idx] = { ...s[idx], unit: v as ServiceUnit };
                  setForm(p => ({ ...p, services: s }));
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["m", "m2", "m3", "un", "vb", "kg", "h"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setForm(p => ({ ...p, services: p.services.filter((_, i) => i !== idx) }))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 6. Avanço por Trecho */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>📏 6. Avanço por Trecho</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addSegment}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
            {trechos.length > 0 && form.segments.length === 0 && (
              <Button size="sm" variant="secondary" onClick={() => {
                const segs: SegmentProgress[] = trechos.map((t, i) => ({
                  id: generateId(),
                  segmentName: t.nomeTrecho || `${t.idInicio}-${t.idFim}`,
                  system: (t.tipoRedeManual === "agua" ? "agua" : t.tipoRedeManual === "drenagem" ? "drenagem" : "esgoto") as SystemType,
                  plannedTotal: t.comprimento,
                  executedBefore: 0,
                  executedToday: 0,
                }));
                setForm(p => ({ ...p, segments: segs }));
                toast.success(`${segs.length} trechos carregados da rede!`);
              }}>
                <Plus className="h-4 w-4 mr-1" /> Carregar da Rede ({trechos.length} trechos)
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Segment filters */}
          {form.segments.length > 0 && (
            <div className="flex gap-2 flex-wrap items-center border-b pb-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                const incomplete = form.segments.filter(s => (s.executedBefore + s.executedToday) < s.plannedTotal);
                if (incomplete.length === form.segments.length) return;
                setForm(p => ({ ...p, segments: incomplete }));
                toast.info(`Filtrado: ${incomplete.length} trechos nao concluidos.`);
              }}>Nao Concluidos</Button>
              {["agua", "esgoto", "drenagem"].map(sys => {
                const count = form.segments.filter(s => s.system === sys).length;
                if (count === 0) return null;
                return (
                  <Badge key={sys} variant="outline" className="text-xs cursor-default">
                    {sys === "agua" ? "💧" : sys === "esgoto" ? "🚰" : "🌧️"} {sys}: {count}
                  </Badge>
                );
              })}
              <Badge variant="outline" className="text-xs">
                Total: {form.segments.length} trechos
              </Badge>
            </div>
          )}

          {form.segments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {trechos.length > 0
                ? 'Clique em "Carregar da Rede" para preencher automaticamente os trechos, ou adicione manualmente.'
                : "Nenhum trecho adicionado. Crie trechos na Topografia primeiro para auto-preencher."}
            </p>
          )}
          {form.segments.map((seg, idx) => (
            <div key={seg.id} className="grid grid-cols-7 gap-2 items-end">
              <Input placeholder="Trecho" value={seg.segmentName}
                onChange={e => {
                  const s = [...form.segments];
                  s[idx] = { ...s[idx], segmentName: e.target.value };
                  setForm(p => ({ ...p, segments: s }));
                }} />
              <Select value={seg.system} onValueChange={v => {
                const s = [...form.segments];
                s[idx] = { ...s[idx], system: v as SystemType };
                setForm(p => ({ ...p, segments: s }));
              }}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agua">💧 Agua</SelectItem>
                  <SelectItem value="esgoto">🚰 Esgoto</SelectItem>
                  <SelectItem value="drenagem">🌧️ Drenagem</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" placeholder="Planej." value={seg.plannedTotal || ""}
                onChange={e => {
                  const s = [...form.segments];
                  s[idx] = { ...s[idx], plannedTotal: Number(e.target.value) };
                  setForm(p => ({ ...p, segments: s }));
                }} />
              <Input type="number" placeholder="Exec. Ant." value={seg.executedBefore || ""}
                onChange={e => {
                  const s = [...form.segments];
                  s[idx] = { ...s[idx], executedBefore: Number(e.target.value) };
                  setForm(p => ({ ...p, segments: s }));
                }} />
              <Input type="number" placeholder="Exec. Hoje" value={seg.executedToday || ""}
                onChange={e => {
                  const s = [...form.segments];
                  s[idx] = { ...s[idx], executedToday: Number(e.target.value) };
                  setForm(p => ({ ...p, segments: s }));
                }} />
              <div className="text-sm text-center font-semibold">
                {(seg.executedBefore + seg.executedToday).toFixed(1)}m
              </div>
              <Button size="icon" variant="ghost" onClick={() => setForm(p => ({ ...p, segments: p.segments.filter((_, i) => i !== idx) }))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 7. Geolocalização */}
      <Card>
        <CardHeader><CardTitle>📍 7. Georreferenciamento</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Latitude</Label>
              <Input value={form.lat} onChange={e => setForm(p => ({ ...p, lat: e.target.value }))} placeholder="-23.550000" />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input value={form.lng} onChange={e => setForm(p => ({ ...p, lng: e.target.value }))} placeholder="-46.630000" />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleGetGPS}>
            <MapPin className="h-4 w-4 mr-1" /> Obter GPS
          </Button>
        </CardContent>
      </Card>

      {/* 8. Observações */}
      <Card>
        <CardHeader><CardTitle>📝 8. Observações e Ocorrências</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Observações Gerais</Label>
            <Textarea placeholder="Observações gerais da obra..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="border-l-4 border-destructive pl-3">
            <Label className="text-destructive font-semibold">Ocorrências</Label>
            <Textarea placeholder="Registrar acidentes, interferências, paralisações..." value={form.occurrences}
              onChange={e => setForm(p => ({ ...p, occurrences: e.target.value }))} className="border-destructive/30" />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onComplete}>Cancelar</Button>
        <Button variant="secondary" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => handleSave("rascunho")}>
          Salvar Rascunho
        </Button>
        <Button onClick={() => handleSave("enviado")} className="bg-green-600 hover:bg-green-700 text-white">
          Gerar RDO
        </Button>
      </div>
    </div>
  );
};
