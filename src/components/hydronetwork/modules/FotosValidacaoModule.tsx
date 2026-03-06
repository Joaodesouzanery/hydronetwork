/**
 * Fotos de Validação Module
 * Upload, organize, and export validation photos linked to RDO dates and segments.
 */
import { useState, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Camera, Upload, Download, Trash2, Image, Filter,
  Calendar, FolderOpen, Eye, Plus, X
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { RDO } from "@/engine/rdo";
import jsPDF from "jspdf";

// ── Types ──

type PhotoCategory =
  | "Escavação"
  | "Assentamento"
  | "Reaterro"
  | "PV/Conexão"
  | "Teste Hidrostático"
  | "Acabamento"
  | "Geral";

const ALL_CATEGORIES: PhotoCategory[] = [
  "Escavação",
  "Assentamento",
  "Reaterro",
  "PV/Conexão",
  "Teste Hidrostático",
  "Acabamento",
  "Geral",
];

interface ValidationPhoto {
  id: string;
  rdoId?: string;
  segmentName?: string;
  date: string;
  description: string;
  category: PhotoCategory;
  base64Data: string;
  createdAt: string;
}

const STORAGE_KEY = "hydronetwork_fotos_validacao";

// ── Helpers ──

function loadPhotos(): ValidationPhoto[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePhotos(photos: ValidationPhoto[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
  } catch (e: unknown) {
    const msg = e instanceof DOMException && e.name === "QuotaExceededError"
      ? "Armazenamento local cheio. Exclua algumas fotos antes de adicionar novas."
      : "Erro ao salvar fotos.";
    toast.error(msg);
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

const categoryColors: Record<PhotoCategory, string> = {
  "Escavação": "bg-amber-600",
  "Assentamento": "bg-blue-600",
  "Reaterro": "bg-green-700",
  "PV/Conexão": "bg-purple-600",
  "Teste Hidrostático": "bg-cyan-600",
  "Acabamento": "bg-pink-600",
  "Geral": "bg-gray-500",
};

// ── Component ──

export const FotosValidacaoModule = ({ rdos }: { rdos: RDO[] }) => {
  const [photos, setPhotos] = useState<ValidationPhoto[]>(loadPhotos);
  const [view, setView] = useState<"gallery" | "upload" | "preview">("gallery");

  // Upload form state
  const [uploadFiles, setUploadFiles] = useState<{ file: File; preview: string }[]>([]);
  const [uploadCategory, setUploadCategory] = useState<PhotoCategory>("Geral");
  const [uploadRdoId, setUploadRdoId] = useState<string>("");
  const [uploadSegment, setUploadSegment] = useState<string>("");
  const [uploadDate, setUploadDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [uploadDescription, setUploadDescription] = useState<string>("");

  // Filter state
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [filterSegment, setFilterSegment] = useState<string>("");

  // Preview state
  const [previewPhoto, setPreviewPhoto] = useState<ValidationPhoto | null>(null);
  const [editDescription, setEditDescription] = useState<string>("");

  // Saving indicator
  const [isSaving, setIsSaving] = useState(false);

  // Unique segments from RDOs + photos
  const allSegments = useMemo(() => {
    const set = new Set<string>();
    rdos.forEach(r => r.segments?.forEach(s => { if (s.segmentName) set.add(s.segmentName); }));
    photos.forEach(p => { if (p.segmentName) set.add(p.segmentName); });
    return Array.from(set).sort();
  }, [rdos, photos]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ALL_CATEGORIES.forEach(c => (counts[c] = 0));
    photos.forEach(p => (counts[p.category] = (counts[p.category] || 0) + 1));
    return counts;
  }, [photos]);

  // Filtered photos
  const filteredPhotos = useMemo(() => {
    return photos.filter(p => {
      if (filterCategory !== "all" && p.category !== filterCategory) return false;
      if (filterDateFrom && p.date < filterDateFrom) return false;
      if (filterDateTo && p.date > filterDateTo) return false;
      if (filterSegment && p.segmentName !== filterSegment) return false;
      return true;
    });
  }, [photos, filterCategory, filterDateFrom, filterDateTo, filterSegment]);

  // Dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const imageFiles = acceptedFiles.filter(f => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast.error("Nenhum arquivo de imagem selecionado.");
      return;
    }
    const newPreviews = imageFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setUploadFiles(prev => [...prev, ...newPreviews]);
    if (view !== "upload") setView("upload");
  }, [view]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"] },
    multiple: true,
    noClick: view !== "upload",
    noDrag: false,
  });

  const removeUploadFile = (index: number) => {
    setUploadFiles(prev => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].preview);
      copy.splice(index, 1);
      return copy;
    });
  };

  // Save uploaded photos
  const handleSavePhotos = async () => {
    if (uploadFiles.length === 0) {
      toast.error("Adicione pelo menos uma foto.");
      return;
    }
    setIsSaving(true);
    try {
      const newPhotos: ValidationPhoto[] = [];
      for (const { file } of uploadFiles) {
        const base64 = await fileToBase64(file);
        newPhotos.push({
          id: crypto.randomUUID(),
          rdoId: uploadRdoId || undefined,
          segmentName: uploadSegment || undefined,
          date: uploadDate,
          description: uploadDescription,
          category: uploadCategory,
          base64Data: base64,
          createdAt: new Date().toISOString(),
        });
      }
      const updated = [...photos, ...newPhotos];
      savePhotos(updated);
      setPhotos(updated);
      // Cleanup
      uploadFiles.forEach(f => URL.revokeObjectURL(f.preview));
      setUploadFiles([]);
      setUploadDescription("");
      setUploadRdoId("");
      setUploadSegment("");
      setUploadCategory("Geral");
      setView("gallery");
      toast.success(`${newPhotos.length} foto(s) salva(s) com sucesso.`);
    } catch {
      toast.error("Erro ao processar as fotos.");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete photo
  const handleDelete = (id: string) => {
    const updated = photos.filter(p => p.id !== id);
    savePhotos(updated);
    setPhotos(updated);
    if (previewPhoto?.id === id) {
      setPreviewPhoto(null);
      setView("gallery");
    }
    toast.success("Foto excluída.");
  };

  // Update description
  const handleUpdateDescription = () => {
    if (!previewPhoto) return;
    const updated = photos.map(p =>
      p.id === previewPhoto.id ? { ...p, description: editDescription } : p
    );
    savePhotos(updated);
    setPhotos(updated);
    setPreviewPhoto({ ...previewPhoto, description: editDescription });
    toast.success("Descrição atualizada.");
  };

  // Open preview
  const openPreview = (photo: ValidationPhoto) => {
    setPreviewPhoto(photo);
    setEditDescription(photo.description);
    setView("preview");
  };

  // Export PDF
  const handleExportPdf = () => {
    if (filteredPhotos.length === 0) {
      toast.error("Nenhuma foto para exportar.");
      return;
    }
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 15;
      const contentW = pageW - margin * 2;
      let y = margin;

      // Title page
      doc.setFontSize(20);
      doc.text("Relatório de Fotos de Validação", pageW / 2, y + 10, { align: "center" });
      doc.setFontSize(11);
      doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, pageW / 2, y + 20, { align: "center" });
      doc.text(`Total de fotos: ${filteredPhotos.length}`, pageW / 2, y + 27, { align: "center" });

      // Summary table
      y = y + 40;
      doc.setFontSize(13);
      doc.text("Resumo por Categoria", margin, y);
      y += 7;
      doc.setFontSize(10);
      ALL_CATEGORIES.forEach(cat => {
        const count = filteredPhotos.filter(p => p.category === cat).length;
        if (count > 0) {
          doc.text(`${cat}: ${count} foto(s)`, margin + 4, y);
          y += 6;
        }
      });

      // Photos by category
      for (const cat of ALL_CATEGORIES) {
        const catPhotos = filteredPhotos.filter(p => p.category === cat);
        if (catPhotos.length === 0) continue;

        doc.addPage();
        y = margin;
        doc.setFontSize(16);
        doc.text(cat, margin, y + 5);
        y += 14;

        for (const photo of catPhotos) {
          if (y > 240) {
            doc.addPage();
            y = margin;
          }

          try {
            const imgW = contentW * 0.7;
            const imgH = imgW * 0.6;
            if (y + imgH + 20 > 280) {
              doc.addPage();
              y = margin;
            }
            doc.addImage(photo.base64Data, "JPEG", margin, y, imgW, imgH);
            y += imgH + 4;
          } catch {
            doc.setFontSize(9);
            doc.text("[Imagem não disponível]", margin, y + 5);
            y += 10;
          }

          doc.setFontSize(9);
          const meta = `Data: ${formatDate(photo.date)}${photo.segmentName ? ` | Trecho: ${photo.segmentName}` : ""}`;
          doc.text(meta, margin, y);
          y += 5;
          if (photo.description) {
            const lines = doc.splitTextToSize(`Descrição: ${photo.description}`, contentW);
            doc.text(lines, margin, y);
            y += lines.length * 4.5;
          }
          y += 8;
        }
      }

      doc.save("fotos_validacao.pdf");
      toast.success("PDF exportado com sucesso.");
    } catch {
      toast.error("Erro ao gerar PDF.");
    }
  };

  // File input ref for gallery add button
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Render ──

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Fotos de Validação
            </CardTitle>
            <CardDescription>
              Registro fotográfico vinculado aos RDOs e trechos da obra
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={view === "gallery" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("gallery")}
            >
              <Image className="h-4 w-4 mr-1" />
              Galeria
            </Button>
            <Button
              variant={view === "upload" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("upload")}
            >
              <Upload className="h-4 w-4 mr-1" />
              Upload
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <Download className="h-4 w-4 mr-1" />
              Exportar PDF
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Category summary badges */}
        <div className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map(cat => (
            <Badge
              key={cat}
              variant="secondary"
              className={`cursor-pointer ${filterCategory === cat ? "ring-2 ring-offset-1 ring-blue-400" : ""}`}
              onClick={() => setFilterCategory(filterCategory === cat ? "all" : cat)}
            >
              <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${categoryColors[cat]}`} />
              {cat}: {categoryCounts[cat]}
            </Badge>
          ))}
          <Badge variant="outline">
            Total: {photos.length}
          </Badge>
        </div>

        {/* ── Upload View ── */}
        {view === "upload" && (
          <div className="space-y-4">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 mx-auto mb-3 text-gray-400" />
              {isDragActive ? (
                <p className="text-blue-600 font-medium">Solte as imagens aqui...</p>
              ) : (
                <div>
                  <p className="font-medium">Arraste fotos aqui ou clique para selecionar</p>
                  <p className="text-sm text-muted-foreground mt-1">PNG, JPG, JPEG, WebP, GIF</p>
                </div>
              )}
            </div>

            {/* Upload preview thumbnails */}
            {uploadFiles.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {uploadFiles.map((uf, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={uf.preview}
                      alt={`preview-${i}`}
                      className="w-full h-20 object-cover rounded border"
                    />
                    <button
                      className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeUploadFile(i)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload metadata form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={uploadCategory} onValueChange={v => setUploadCategory(v as PhotoCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={uploadDate} onChange={e => setUploadDate(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>RDO Vinculado (opcional)</Label>
                <Select value={uploadRdoId} onValueChange={setUploadRdoId}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {rdos.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {formatDate(r.date)} - {r.projectName || r.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Trecho (opcional)</Label>
                {allSegments.length > 0 ? (
                  <Select value={uploadSegment} onValueChange={setUploadSegment}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {allSegments.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={uploadSegment}
                    onChange={e => setUploadSegment(e.target.value)}
                    placeholder="Nome do trecho"
                  />
                )}
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label>Descrição</Label>
                <Textarea
                  value={uploadDescription}
                  onChange={e => setUploadDescription(e.target.value)}
                  placeholder="Descrição ou observações sobre a(s) foto(s)..."
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                uploadFiles.forEach(f => URL.revokeObjectURL(f.preview));
                setUploadFiles([]);
                setView("gallery");
              }}>
                Cancelar
              </Button>
              <Button onClick={handleSavePhotos} disabled={isSaving || uploadFiles.length === 0}>
                <Plus className="h-4 w-4 mr-1" />
                {isSaving ? "Salvando..." : `Salvar ${uploadFiles.length} Foto(s)`}
              </Button>
            </div>
          </div>
        )}

        {/* ── Gallery View ── */}
        {view === "gallery" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Filter className="h-3 w-3" />Categoria</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[160px] h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {ALL_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" />De</Label>
                <Input type="date" className="w-[150px] h-8 text-sm" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Até</Label>
                <Input type="date" className="w-[150px] h-8 text-sm" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
              </div>
              {allSegments.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><FolderOpen className="h-3 w-3" />Trecho</Label>
                  <Select value={filterSegment || "all"} onValueChange={v => setFilterSegment(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-[160px] h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {allSegments.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(filterCategory !== "all" || filterDateFrom || filterDateTo || filterSegment) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => { setFilterCategory("all"); setFilterDateFrom(""); setFilterDateTo(""); setFilterSegment(""); }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpar
                </Button>
              )}
            </div>

            {/* Thumbnail grid */}
            {filteredPhotos.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Image className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nenhuma foto encontrada</p>
                <p className="text-sm mt-1">
                  {photos.length === 0
                    ? "Clique em \"Upload\" para adicionar fotos de validação."
                    : "Ajuste os filtros para ver mais resultados."}
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {filteredPhotos.length} foto(s) encontrada(s)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {filteredPhotos.map(photo => (
                    <div
                      key={photo.id}
                      className="group relative rounded-lg overflow-hidden border bg-muted cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                      onClick={() => openPreview(photo)}
                    >
                      <img
                        src={photo.base64Data}
                        alt={photo.description || photo.category}
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="p-1.5">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${categoryColors[photo.category]}`} />
                          {photo.category}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {formatDate(photo.date)}
                          {photo.segmentName ? ` | ${photo.segmentName}` : ""}
                        </p>
                      </div>
                      <button
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={e => { e.stopPropagation(); handleDelete(photo.id); }}
                        title="Excluir foto"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Hidden file input for adding photos from gallery */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => {
                if (e.target.files) {
                  onDrop(Array.from(e.target.files));
                  e.target.value = "";
                }
              }}
            />
          </div>
        )}

        {/* ── Preview View ── */}
        {view === "preview" && previewPhoto && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setView("gallery")}>
              <X className="h-4 w-4 mr-1" />
              Voltar à Galeria
            </Button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Image */}
              <div className="lg:col-span-2">
                <img
                  src={previewPhoto.base64Data}
                  alt={previewPhoto.description || previewPhoto.category}
                  className="w-full max-h-[70vh] object-contain rounded-lg border bg-black"
                />
              </div>

              {/* Metadata panel */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Detalhes da Foto</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Categoria:</span>
                      <Badge variant="secondary" className="ml-2">
                        <span className={`inline-block w-2 h-2 rounded-full mr-1 ${categoryColors[previewPhoto.category]}`} />
                        {previewPhoto.category}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data:</span>
                      <span className="ml-2">{formatDate(previewPhoto.date)}</span>
                    </div>
                    {previewPhoto.segmentName && (
                      <div>
                        <span className="text-muted-foreground">Trecho:</span>
                        <span className="ml-2">{previewPhoto.segmentName}</span>
                      </div>
                    )}
                    {previewPhoto.rdoId && (
                      <div>
                        <span className="text-muted-foreground">RDO:</span>
                        <span className="ml-2">
                          {rdos.find(r => r.id === previewPhoto.rdoId)
                            ? `${formatDate(rdos.find(r => r.id === previewPhoto.rdoId)!.date)} - ${rdos.find(r => r.id === previewPhoto.rdoId)!.projectName}`
                            : previewPhoto.rdoId.slice(0, 8)}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Adicionada em:</span>
                      <span className="ml-2">{formatDate(previewPhoto.createdAt)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Descrição / Notas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Textarea
                      value={editDescription}
                      onChange={e => setEditDescription(e.target.value)}
                      placeholder="Adicione uma descrição ou notas..."
                      rows={4}
                    />
                    <Button
                      size="sm"
                      onClick={handleUpdateDescription}
                      disabled={editDescription === previewPhoto.description}
                    >
                      Salvar Descrição
                    </Button>
                  </CardContent>
                </Card>

                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => handleDelete(previewPhoto.id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir Foto
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
