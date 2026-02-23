import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Edit, Save, Tag, Filter, Wand2 } from "lucide-react";
import { Trecho, TipoRedeManual } from "@/engine/domain";
import { TrechoMetadata, applyNamingPattern } from "@/engine/savedPlanning";

interface TrechoEditorPanelProps {
  trechos: Trecho[];
  metadata: TrechoMetadata[];
  onMetadataChange: (metadata: TrechoMetadata[]) => void;
  onTrechosChange?: (trechos: Trecho[]) => void;
}

const REDE_OPTIONS: { value: TipoRedeManual; label: string; icon: string }[] = [
  { value: "agua", label: "Agua", icon: "💧" },
  { value: "esgoto", label: "Esgoto", icon: "🚰" },
  { value: "drenagem", label: "Drenagem", icon: "🌧️" },
  { value: "recalque", label: "Recalque", icon: "⬆️" },
  { value: "outro", label: "Outro", icon: "📌" },
];

const fmt = (n: number, d = 2) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export function TrechoEditorPanel({ trechos, metadata, onMetadataChange, onTrechosChange }: TrechoEditorPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterRede, setFilterRede] = useState<string>("all");
  const [filterFrente, setFilterFrente] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [batchPrefix, setBatchPrefix] = useState("");
  const [batchRede, setBatchRede] = useState<TipoRedeManual>("esgoto");
  const [batchFrente, setBatchFrente] = useState("");
  const [batchLote, setBatchLote] = useState("");

  const getTrechoKey = (t: Trecho) => `${t.idInicio}-${t.idFim}`;

  const getMeta = (key: string): TrechoMetadata => {
    const existing = metadata.find(m => m.trechoKey === key);
    return existing || {
      trechoKey: key,
      nomeTrecho: "",
      codigoTrecho: "",
      tipoRedeManual: "esgoto",
      frenteServico: "",
      lote: "",
      grupo: "",
    };
  };

  const updateMeta = (key: string, field: keyof TrechoMetadata, value: string) => {
    const updated = [...metadata];
    const idx = updated.findIndex(m => m.trechoKey === key);
    if (idx >= 0) {
      updated[idx] = { ...updated[idx], [field]: value };
    } else {
      updated.push({ ...getMeta(key), [field]: value });
    }
    onMetadataChange(updated);
  };

  // Get unique frentes from metadata
  const frentes = useMemo(() => {
    const set = new Set(metadata.map(m => m.frenteServico).filter(Boolean));
    return Array.from(set);
  }, [metadata]);

  // Filtered trechos
  const filtered = useMemo(() => {
    return trechos.filter((t, i) => {
      const key = getTrechoKey(t);
      const meta = getMeta(key);
      if (filterRede !== "all" && meta.tipoRedeManual !== filterRede) return false;
      if (filterFrente !== "all" && meta.frenteServico !== filterFrente) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          key.toLowerCase().includes(s) ||
          meta.nomeTrecho.toLowerCase().includes(s) ||
          meta.codigoTrecho.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [trechos, metadata, filterRede, filterFrente, search]);

  const toggleSelect = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(t => getTrechoKey(t))));
    }
  };

  const applyBatchNaming = () => {
    if (selected.size === 0) { toast.error("Selecione trechos primeiro."); return; }
    if (!batchPrefix) { toast.error("Digite um prefixo."); return; }
    const keys = Array.from(selected);
    const updated = applyNamingPattern(metadata, keys, batchPrefix);
    onMetadataChange(updated);
    toast.success(`${keys.length} trechos renomeados com prefixo "${batchPrefix}".`);
  };

  const applyBatchRede = () => {
    if (selected.size === 0) { toast.error("Selecione trechos primeiro."); return; }
    const updated = [...metadata];
    for (const key of selected) {
      const idx = updated.findIndex(m => m.trechoKey === key);
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], tipoRedeManual: batchRede };
      } else {
        updated.push({ ...getMeta(key), tipoRedeManual: batchRede });
      }
    }
    onMetadataChange(updated);
    toast.success(`${selected.size} trechos classificados como "${batchRede}".`);
  };

  const applyBatchFrente = () => {
    if (selected.size === 0) { toast.error("Selecione trechos primeiro."); return; }
    if (!batchFrente) { toast.error("Digite a frente de servico."); return; }
    const updated = [...metadata];
    for (const key of selected) {
      const idx = updated.findIndex(m => m.trechoKey === key);
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], frenteServico: batchFrente };
      } else {
        updated.push({ ...getMeta(key), frenteServico: batchFrente });
      }
    }
    onMetadataChange(updated);
    toast.success(`${selected.size} trechos atribuidos a frente "${batchFrente}".`);
  };

  const applyBatchLote = () => {
    if (selected.size === 0) { toast.error("Selecione trechos primeiro."); return; }
    if (!batchLote) { toast.error("Digite o lote/area."); return; }
    const updated = [...metadata];
    for (const key of selected) {
      const idx = updated.findIndex(m => m.trechoKey === key);
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], lote: batchLote };
      } else {
        updated.push({ ...getMeta(key), lote: batchLote });
      }
    }
    onMetadataChange(updated);
    toast.success(`${selected.size} trechos atribuidos ao lote "${batchLote}".`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Edit className="h-5 w-5" /> Editor de Trechos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Buscar trecho..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-48 h-8 text-sm"
          />
          <Select value={filterRede} onValueChange={setFilterRede}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Tipo de Rede" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as redes</SelectItem>
              {REDE_OPTIONS.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.icon} {r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {frentes.length > 0 && (
            <Select value={filterFrente} onValueChange={setFilterFrente}>
              <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Frente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as frentes</SelectItem>
                {frentes.map(f => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Badge variant="outline" className="text-xs h-8 flex items-center">
            {selected.size} selecionados / {filtered.length} trechos
          </Badge>
        </div>

        {/* Batch operations */}
        {selected.size > 0 && (
          <Card className="bg-primary/5 border-primary/30">
            <CardContent className="pt-3 pb-3">
              <p className="font-semibold text-sm mb-2 flex items-center gap-1">
                <Wand2 className="h-4 w-4" /> Operacoes em Lote ({selected.size} selecionados)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Naming pattern */}
                <div className="flex gap-1 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Prefixo de Nome</Label>
                    <Input value={batchPrefix} onChange={e => setBatchPrefix(e.target.value)} placeholder="Esg-L1-" className="h-8 text-sm" />
                  </div>
                  <Button size="sm" className="h-8" onClick={applyBatchNaming}>
                    <Tag className="h-3 w-3 mr-1" /> Nomear
                  </Button>
                </div>
                {/* Batch rede */}
                <div className="flex gap-1 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Tipo de Rede</Label>
                    <Select value={batchRede} onValueChange={v => setBatchRede(v as TipoRedeManual)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REDE_OPTIONS.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.icon} {r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" className="h-8" onClick={applyBatchRede}>Aplicar</Button>
                </div>
                {/* Batch frente */}
                <div className="flex gap-1 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Frente de Servico</Label>
                    <Input value={batchFrente} onChange={e => setBatchFrente(e.target.value)} placeholder="Frente 1" className="h-8 text-sm" />
                  </div>
                  <Button size="sm" className="h-8" onClick={applyBatchFrente}>Aplicar</Button>
                </div>
                {/* Batch lote */}
                <div className="flex gap-1 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Lote / Area</Label>
                    <Input value={batchLote} onChange={e => setBatchLote(e.target.value)} placeholder="Lote A" className="h-8 text-sm" />
                  </div>
                  <Button size="sm" className="h-8" onClick={applyBatchLote}>Aplicar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onCheckedChange={selectAll}
                  />
                </TableHead>
                <TableHead className="text-xs">Trecho (ID)</TableHead>
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs">Codigo</TableHead>
                <TableHead className="text-xs">Rede</TableHead>
                <TableHead className="text-xs">Frente</TableHead>
                <TableHead className="text-xs">Lote</TableHead>
                <TableHead className="text-xs">Comp. (m)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t, i) => {
                const key = getTrechoKey(t);
                const meta = getMeta(key);
                const isSelected = selected.has(key);
                return (
                  <TableRow key={key} className={isSelected ? "bg-primary/10" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(key)}
                      />
                    </TableCell>
                    <TableCell className="text-xs font-mono">{key}</TableCell>
                    <TableCell>
                      <Input
                        value={meta.nomeTrecho}
                        onChange={e => updateMeta(key, "nomeTrecho", e.target.value)}
                        placeholder="Nome do trecho"
                        className="h-7 text-xs w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={meta.codigoTrecho}
                        onChange={e => updateMeta(key, "codigoTrecho", e.target.value)}
                        placeholder="Codigo"
                        className="h-7 text-xs w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={meta.tipoRedeManual}
                        onValueChange={v => updateMeta(key, "tipoRedeManual", v)}
                      >
                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {REDE_OPTIONS.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.icon} {r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={meta.frenteServico}
                        onChange={e => updateMeta(key, "frenteServico", e.target.value)}
                        placeholder="Frente"
                        className="h-7 text-xs w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={meta.lote}
                        onChange={e => updateMeta(key, "lote", e.target.value)}
                        placeholder="Lote"
                        className="h-7 text-xs w-20"
                      />
                    </TableCell>
                    <TableCell className="text-xs">{fmt(t.comprimento)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
