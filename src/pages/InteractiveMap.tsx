import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import JSZip from "jszip";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabase";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  MapPin,
  Plus,
  Save,
  Trash2,
  Map,
  Loader2,
  FileArchive,
  ArrowLeft,
  Code,
  Copy,
  ExternalLink,
  RefreshCw,
  Link,
  Globe,
  AlertTriangle,
  X,
  Layers,
  MousePointerClick,
  Crosshair,
  WifiOff,
  Eye,
  EyeOff,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CONSTRAINT_TYPES, STATUS_LABELS } from "@/types/lean-constraints";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";

// ── Tile Layers ──
const TILE_LAYERS: Record<string, { url: string; attribution: string; name: string }> = {
  osm: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "\u00a9 OpenStreetMap", name: "OpenStreetMap" },
  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "\u00a9 Esri", name: "Satelite (Esri)" },
  topo: { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", attribution: "\u00a9 OpenTopoMap", name: "Topografico" },
  dark: { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attribution: "\u00a9 CartoDB", name: "Escuro" },
  light: { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", attribution: "\u00a9 CartoDB", name: "Claro" },
};

// ── Offline Tile Cache ──
const TILE_CACHE_NAME = "hydronetwork-tiles-v1";

async function cacheTileUrl(url: string): Promise<void> {
  try {
    const cache = await caches.open(TILE_CACHE_NAME);
    const existing = await cache.match(url);
    if (!existing) {
      await cache.add(url);
    }
  } catch { /* cache API not available */ }
}

async function getCachedTileCount(): Promise<number> {
  try {
    const cache = await caches.open(TILE_CACHE_NAME);
    const keys = await cache.keys();
    return keys.length;
  } catch { return 0; }
}

async function clearTileCache(): Promise<void> {
  try {
    await caches.delete(TILE_CACHE_NAME);
  } catch { /* ignore */ }
}

// Annotation marker colors based on type
function getAnnotationColor(tipo: string): string {
  switch (tipo) {
    case "ponto": return "#3B82F6";
    case "area": return "#22C55E";
    case "setor": return "#F59E0B";
    case "inspecao": return "#EF4444";
    default: return "#6366f1";
  }
}

interface MapAnnotation {
  id: string;
  project_id: string;
  latitude: number;
  longitude: number;
  tipo: string;
  descricao?: string;
  porcentagem: number;
  team_id?: string;
  service_front_id?: string;
  created_at: string;
}

type MapSourceType = "zip" | "url";

export default function InteractiveMap() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Leaflet map refs
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletContainerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Development notice state
  const [showDevNotice, setShowDevNotice] = useState(true);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showAddMarkerDialog, setShowAddMarkerDialog] = useState(false);
  const [showMapSourceDialog, setShowMapSourceDialog] = useState(false);
  const [mapSourceType, setMapSourceType] = useState<MapSourceType>("zip");
  const [externalMapUrl, setExternalMapUrl] = useState("");
  const [signedMapUrl, setSignedMapUrl] = useState<string | null>(null);
  const [newMarker, setNewMarker] = useState({
    latitude: 0,
    longitude: 0,
    tipo: "ponto",
    descricao: "",
    porcentagem: 0,
    team_id: "",
    service_front_id: "",
  });
  const [activeTab, setActiveTab] = useState("map");

  // Leaflet map state
  const [mapMode, setMapMode] = useState<"view" | "leaflet">("leaflet");
  const [clickToAddMode, setClickToAddMode] = useState(false);
  const [tileKey, setTileKey] = useState("osm");
  const [showAnnotationLayer, setShowAnnotationLayer] = useState(true);
  const [showConstraintLayer, setShowConstraintLayer] = useState(false);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [cachedTileCount, setCachedTileCount] = useState(0);
  const [annotationFilter, setAnnotationFilter] = useState<string>("all");

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && !!session,
  });

  const { data: annotations = [] } = useQuery({
    queryKey: ["map-annotations", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("map_annotations")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MapAnnotation[];
    },
    enabled: !!projectId && !!session,
  });

  const mapConstraints: any[] = [];

  const { data: serviceFronts = [] } = useQuery({
    queryKey: ["service-fronts", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await supabase
        .from("service_fronts")
        .select("id, name")
        .eq("project_id", projectId);
      return data || [];
    },
    enabled: !!projectId && !!session,
  });

  const uploadMapMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!session?.user?.id || !projectId) throw new Error("Usuário ou projeto não encontrado");

      setIsUploading(true);
      setUploadProgress(5);

      try {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        
        setUploadProgress(15);

        // Find main HTML file (prefer index.html, but accept any .html)
        let indexHtmlPath: string | null = null;
        let baseFolder = "";
        
        const allPaths = Object.keys(zipContent.files);
        
        // First try to find a file literally named index.html
        for (const path of allPaths) {
          const fileName = path.split("/").pop()?.toLowerCase();
          if (fileName === "index.html") {
            indexHtmlPath = path;
            const parts = path.split("/");
            if (parts.length > 1) {
              baseFolder = parts.slice(0, -1).join("/") + "/";
            }
            break;
          }
        }

        // If not found, fall back to the first .html file
        if (!indexHtmlPath) {
          for (const path of allPaths) {
            const fileName = path.split("/").pop()?.toLowerCase();
            if (fileName && fileName.endsWith(".html")) {
              indexHtmlPath = path;
              const parts = path.split("/");
              if (parts.length > 1) {
                baseFolder = parts.slice(0, -1).join("/") + "/";
              }
              break;
            }
          }
        }

        if (!indexHtmlPath) {
          throw new Error("Nenhum arquivo .html encontrado no ZIP. Certifique-se de exportar o mapa completo pelo qgis2web.");
        }

        setUploadProgress(25);

        // Collect all files to upload
        const filesToUpload: { path: string; content: ArrayBuffer; contentType: string }[] = [];

        for (const [relativePath, zipEntry] of Object.entries(zipContent.files)) {
          if (!zipEntry.dir) {
            try {
              const content = await zipEntry.async("arraybuffer");
              
              // Remove base folder from path
              let cleanPath = relativePath;
              if (baseFolder && relativePath.startsWith(baseFolder)) {
                cleanPath = relativePath.substring(baseFolder.length);
              }
              
              // Skip empty paths
              if (!cleanPath || cleanPath === "") continue;
              
              // Determine content type
              const ext = cleanPath.toLowerCase().split(".").pop() || "";
              const mimeTypes: Record<string, string> = {
                html: "text/html",
                htm: "text/html",
                css: "text/css",
                js: "application/javascript",
                mjs: "application/javascript",
                json: "application/json",
                geojson: "application/json",
                png: "image/png",
                jpg: "image/jpeg",
                jpeg: "image/jpeg",
                gif: "image/gif",
                svg: "image/svg+xml",
                ico: "image/x-icon",
                webp: "image/webp",
                woff: "font/woff",
                woff2: "font/woff2",
                ttf: "font/ttf",
                eot: "application/vnd.ms-fontobject",
                otf: "font/otf",
              };
              const contentType = mimeTypes[ext] || "application/octet-stream";
              
              filesToUpload.push({ path: cleanPath, content, contentType });
            } catch (err) {
              console.warn(`Não foi possível processar: ${relativePath}`, err);
            }
          }
        }

        if (filesToUpload.length === 0) {
          throw new Error("Nenhum arquivo válido encontrado no ZIP.");
        }

        setUploadProgress(35);

        // Delete existing files for this project
        try {
          const { data: existingFiles } = await supabase.storage
            .from("interactive-maps")
            .list(projectId);
          
          if (existingFiles && existingFiles.length > 0) {
            const filePaths = existingFiles.map(f => `${projectId}/${f.name}`);
            await supabase.storage.from("interactive-maps").remove(filePaths);
          }
        } catch (err) {
          console.warn("Erro ao limpar arquivos existentes:", err);
        }
        
        setUploadProgress(45);

        // Upload files in smaller batches
        const batchSize = 3;
        let uploadedCount = 0;
        let hasErrors = false;
        
        for (let i = 0; i < filesToUpload.length; i += batchSize) {
          const batch = filesToUpload.slice(i, i + batchSize);
          
          await Promise.all(
            batch.map(async ({ path, content, contentType }) => {
              const storagePath = `${projectId}/${path}`;
              const blob = new Blob([content], { type: contentType });
              
              const { error } = await supabase.storage
                .from("interactive-maps")
                .upload(storagePath, blob, { 
                  upsert: true,
                  contentType,
                });
              
              if (error) {
                console.error(`Erro ao enviar ${path}:`, error.message);
                hasErrors = true;
              }
            })
          );
          
          uploadedCount += batch.length;
          const progress = 45 + Math.round((uploadedCount / filesToUpload.length) * 45);
          setUploadProgress(Math.min(progress, 90));
        }

        if (hasErrors) {
          console.warn("Alguns arquivos não foram enviados, mas o mapa pode funcionar parcialmente.");
        }

        setUploadProgress(92);

        // Descobrir o caminho "limpo" do HTML principal (após remover pasta-base)
        let indexCleanPath = indexHtmlPath;
        if (baseFolder && indexHtmlPath.startsWith(baseFolder)) {
          indexCleanPath = indexHtmlPath.substring(baseFolder.length);
        }

        // Store the file path (not URL) in the project - we'll generate signed URLs on demand
        const storagePath = `${projectId}/${indexCleanPath}`;

        // Update project with the storage path (not public URL)
        const { error: updateError } = await supabase
          .from("projects")
          .update({ interactive_map_url: storagePath })
          .eq("id", projectId);

        if (updateError) {
          throw new Error("Erro ao salvar URL do mapa no projeto.");
        }

        setUploadProgress(100);
        return storagePath;
      } catch (err: any) {
        throw new Error(err.message || "Erro ao processar o arquivo ZIP.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast({
        title: "Mapa enviado com sucesso!",
        description: "O mapa interativo foi carregado e está pronto para uso.",
      });
      setIsUploading(false);
      setUploadProgress(0);
    },
    onError: (error: any) => {
      console.error("Erro no upload:", error);
      toast({
        title: "Erro ao enviar mapa",
        description: error.message || "Verifique se o arquivo ZIP está correto e tente novamente.",
        variant: "destructive",
      });
      setIsUploading(false);
      setUploadProgress(0);
    },
  });

  const addAnnotationMutation = useMutation({
    mutationFn: async (data: typeof newMarker) => {
      if (!session?.user?.id || !projectId) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("map_annotations")
        .insert({
          project_id: projectId,
          latitude: data.latitude,
          longitude: data.longitude,
          tipo: data.tipo,
          descricao: data.descricao || null,
          porcentagem: data.porcentagem,
          team_id: data.team_id || null,
          service_front_id: data.service_front_id || null,
          created_by_user_id: session.user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["map-annotations", projectId] });
      toast({ title: "Anotação adicionada!" });
      setShowAddMarkerDialog(false);
      setNewMarker({
        latitude: 0,
        longitude: 0,
        tipo: "ponto",
        descricao: "",
        porcentagem: 0,
        team_id: "",
        service_front_id: "",
      });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar anotação", variant: "destructive" });
    },
  });

  const deleteAnnotationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("map_annotations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["map-annotations", projectId] });
      toast({ title: "Anotação removida!" });
    },
  });

  const saveExternalUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      if (!projectId) throw new Error("Projeto não encontrado");

      const { error } = await supabase
        .from("projects")
        .update({ interactive_map_url: url })
        .eq("id", projectId);

      if (error) throw error;
      return url;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast({
        title: "URL do mapa salva!",
        description: "O mapa externo foi configurado com sucesso.",
      });
      setShowMapSourceDialog(false);
      setExternalMapUrl("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar URL",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast({
        title: "Formato inválido",
        description: "Por favor, envie um arquivo ZIP exportado do QGIS (qgis2web).",
        variant: "destructive",
      });
      return;
    }

    uploadMapMutation.mutate(file);
    e.target.value = "";
    setShowMapSourceDialog(false);
  }, [uploadMapMutation, toast]);

  const handleSaveExternalUrl = () => {
    if (!externalMapUrl.trim()) {
      toast({
        title: "URL inválida",
        description: "Por favor, insira uma URL válida.",
        variant: "destructive",
      });
      return;
    }

    // Validar URL
    try {
      new URL(externalMapUrl);
    } catch {
      toast({
        title: "URL inválida",
        description: "Por favor, insira uma URL válida (ex: https://exemplo.com/mapa).",
        variant: "destructive",
      });
      return;
    }

    saveExternalUrlMutation.mutate(externalMapUrl.trim());
  };

  const isExternalUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    return url.startsWith("http://") || url.startsWith("https://");
  };

  const isStorageUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    // Check if it's a storage path (not a full URL) - storage paths don't start with http
    return !url.startsWith("http://") && !url.startsWith("https://") && url.includes("/");
  };

  // Generate signed URL for storage maps
  const getMapDisplayUrl = useCallback(async () => {
    if (!project?.interactive_map_url) return null;
    
    // If it's an external URL, use it directly
    if (isExternalUrl(project.interactive_map_url)) {
      return project.interactive_map_url;
    }
    
    // If it's a storage path, generate a signed URL
    if (isStorageUrl(project.interactive_map_url)) {
      const { data, error } = await supabase.storage
        .from("interactive-maps")
        .createSignedUrl(project.interactive_map_url, 3600); // 1 hour expiry
      
      if (error) {
        console.error("Error creating signed URL:", error);
        return null;
      }
      return data.signedUrl;
    }
    
    return project.interactive_map_url;
  }, [project?.interactive_map_url]);

  // Load signed URL when project changes
  useEffect(() => {
    const loadSignedUrl = async () => {
      const url = await getMapDisplayUrl();
      setSignedMapUrl(url);
    };
    if (project?.interactive_map_url) {
      loadSignedUrl();
    }
  }, [project?.interactive_map_url, getMapDisplayUrl]);

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return "text-green-500";
    if (progress >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  // Initialize Leaflet map
  useEffect(() => {
    if (!leafletContainerRef.current || leafletMapRef.current) return;
    if (activeTab !== "map") return;

    const map = L.map(leafletContainerRef.current, { zoomControl: true }).setView([-23.55, -46.63], 14);
    const tile = L.tileLayer(TILE_LAYERS.osm.url, { attribution: TILE_LAYERS.osm.attribution, maxZoom: 19 }).addTo(map);
    tileLayerRef.current = tile;
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    leafletMapRef.current = map;

    // Cache loaded tiles for offline use
    map.on("tileload", (e: any) => {
      if (e.tile?.src) {
        cacheTileUrl(e.tile.src);
      }
    });

    setTimeout(() => map.invalidateSize(), 200);
    setTimeout(() => map.invalidateSize(), 500);

    return () => {
      map.remove();
      leafletMapRef.current = null;
      tileLayerRef.current = null;
      markersLayerRef.current = null;
    };
  }, [activeTab]);

  // Update tile layer when changed
  useEffect(() => {
    if (!leafletMapRef.current || !tileLayerRef.current) return;
    const layerConfig = TILE_LAYERS[tileKey];
    if (!layerConfig) return;
    tileLayerRef.current.setUrl(layerConfig.url);
  }, [tileKey]);

  // Render annotations on Leaflet map
  useEffect(() => {
    if (!leafletMapRef.current || !markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    if (!showAnnotationLayer) return;

    const filtered = annotationFilter === "all"
      ? annotations
      : annotations.filter(a => a.tipo === annotationFilter);

    filtered.forEach((annotation) => {
      const color = getAnnotationColor(annotation.tipo);
      const marker = L.circleMarker([annotation.latitude, annotation.longitude], {
        radius: 10,
        fillColor: color,
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
      }).addTo(markersLayerRef.current!);

      marker.bindPopup(`
        <div style="min-width:180px">
          <strong>${annotation.tipo.charAt(0).toUpperCase() + annotation.tipo.slice(1)}</strong>
          ${annotation.descricao ? `<br/><span style="color:#666">${annotation.descricao}</span>` : ""}
          <br/><strong>Avanco:</strong> ${annotation.porcentagem}%
          <br/><small>Lat: ${annotation.latitude.toFixed(6)}, Lng: ${annotation.longitude.toFixed(6)}</small>
        </div>
      `);
    });

    // Fit map to annotations if any
    if (filtered.length > 0) {
      const bounds = L.latLngBounds(filtered.map(a => [a.latitude, a.longitude] as [number, number]));
      if (bounds.isValid()) {
        leafletMapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [annotations, showAnnotationLayer, annotationFilter, activeTab]);

  // Render constraint markers on Leaflet map
  useEffect(() => {
    if (!leafletMapRef.current || !markersLayerRef.current) return;
    if (!showConstraintLayer || mapConstraints.length === 0) return;

    const constraintMarkers: L.CircleMarker[] = [];
    const statusColors: Record<string, string> = { ativa: '#F59E0B', critica: '#EF4444', resolvida: '#22C55E' };

    mapConstraints.forEach((c: any) => {
      if (c.latitude == null || c.longitude == null) return;
      const color = statusColors[c.status] || '#6b7280';
      const radius = c.status === 'critica' ? 12 : c.status === 'ativa' ? 9 : 7;

      const marker = L.circleMarker([c.latitude, c.longitude], {
        radius,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
        className: c.status === 'critica' ? 'pulse-marker' : '',
      }).addTo(markersLayerRef.current!);

      const tipo = CONSTRAINT_TYPES[c.tipo_restricao as keyof typeof CONSTRAINT_TYPES] || c.tipo_restricao;
      const status = STATUS_LABELS[c.status as keyof typeof STATUS_LABELS] || c.status;
      const resp = c.employees?.name || c.responsavel_nome || '';

      marker.bindPopup(`
        <div style="min-width:200px">
          <strong>${tipo}</strong>
          <br/><span style="color:${color}">${status}</span>
          <hr style="margin:4px 0"/>
          <small>${c.descricao}</small>
          ${resp ? `<br/><small><strong>Resp:</strong> ${resp}</small>` : ''}
          <br/><small><strong>Data:</strong> ${c.data_identificacao}</small>
        </div>
      `);

      constraintMarkers.push(marker);
    });

    return () => {
      constraintMarkers.forEach(m => m.remove());
    };
  }, [mapConstraints, showConstraintLayer]);

  // Click-to-add annotation handler
  useEffect(() => {
    if (!leafletMapRef.current) return;
    const map = leafletMapRef.current;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (!clickToAddMode) return;
      setNewMarker(prev => ({
        ...prev,
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
      }));
      setShowAddMarkerDialog(true);
      setClickToAddMode(false);
    };

    map.on("click", handleClick);
    if (clickToAddMode) {
      map.getContainer().style.cursor = "crosshair";
    } else {
      map.getContainer().style.cursor = "";
    }

    return () => {
      map.off("click", handleClick);
      map.getContainer().style.cursor = "";
    };
  }, [clickToAddMode]);

  // Load cached tile count
  useEffect(() => {
    getCachedTileCount().then(setCachedTileCount);
  }, []);

  if (loadingProject) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1 p-6 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-6">
          {/* Development Notice Banner */}
          {showDevNotice && (
            <Alert className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 dark:text-amber-200 flex items-center justify-between">
                <span>Funcionalidade em Desenvolvimento</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => setShowDevNotice(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                O Mapa Interativo está em fase de desenvolvimento. Algumas funcionalidades podem não estar disponíveis ou funcionar de forma limitada. Agradecemos sua paciência!
              </AlertDescription>
            </Alert>
          )}

          <div className="mb-6">
            <Button variant="ghost" onClick={() => navigate("/projects")} className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar aos Projetos
            </Button>
            <h1 className="text-3xl font-bold font-mono flex items-center gap-2">
              <Map className="h-8 w-8" />
              Mapa Interativo
            </h1>
            <p className="text-muted-foreground">
              {project?.name || "Projeto"} - Importe mapas do QGIS e gerencie anotações
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="map">
                <Map className="h-4 w-4 mr-2" />
                Mapa
              </TabsTrigger>
              <TabsTrigger value="annotations">
                <MapPin className="h-4 w-4 mr-2" />
                Anotações ({annotations.length})
              </TabsTrigger>
              <TabsTrigger value="embed">
                <Code className="h-4 w-4 mr-2" />
                Embed / Plugin
              </TabsTrigger>
            </TabsList>

            <TabsContent value="map" className="space-y-4">
              {/* Map Controls Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {project?.interactive_map_url && (
                    <>
                      {isStorageUrl(project.interactive_map_url) ? (
                        <Badge variant="secondary">
                          <FileArchive className="h-3 w-3 mr-1" />
                          Mapa ZIP (QGIS)
                        </Badge>
                      ) : isExternalUrl(project.interactive_map_url) ? (
                        <Badge variant="outline">
                          <Globe className="h-3 w-3 mr-1" />
                          URL Externa
                        </Badge>
                      ) : null}
                    </>
                  )}
                  <Badge variant={mapMode === "leaflet" ? "default" : "outline"} className="cursor-pointer" onClick={() => setMapMode("leaflet")}>
                    <Map className="h-3 w-3 mr-1" />Leaflet
                  </Badge>
                  {project?.interactive_map_url && (
                    <Badge variant={mapMode === "view" ? "default" : "outline"} className="cursor-pointer" onClick={() => setMapMode("view")}>
                      <Globe className="h-3 w-3 mr-1" />QGIS/iframe
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <input ref={fileInputRef} type="file" accept=".zip" onChange={handleFileUpload} className="hidden" />
                  <input ref={replaceInputRef} type="file" accept=".zip" onChange={handleFileUpload} className="hidden" />
                  {project?.interactive_map_url && (
                    <Button variant="outline" size="sm" onClick={() => replaceInputRef.current?.click()} disabled={isUploading}>
                      <RefreshCw className="h-4 w-4 mr-2" />Atualizar (ZIP)
                    </Button>
                  )}
                  {!project?.interactive_map_url && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <FileArchive className="h-4 w-4 mr-2" />Upload ZIP
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setMapSourceType("url"); setShowMapSourceDialog(true); }}>
                        <Globe className="h-4 w-4 mr-2" />URL Externa
                      </Button>
                    </>
                  )}
                  <Button
                    variant={clickToAddMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setClickToAddMode(!clickToAddMode)}
                  >
                    {clickToAddMode ? <Crosshair className="h-4 w-4 mr-2 animate-pulse" /> : <MousePointerClick className="h-4 w-4 mr-2" />}
                    {clickToAddMode ? "Clique no mapa..." : "Adicionar no Mapa"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowAddMarkerDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />Manual
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowLayerPanel(!showLayerPanel)}>
                    <Layers className="h-4 w-4 mr-2" />Camadas
                  </Button>
                </div>
              </div>

              {isUploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} />
                  <p className="text-sm text-center text-muted-foreground">Processando... {uploadProgress}%</p>
                </div>
              )}

              {/* Layer Control Panel */}
              {showLayerPanel && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Layers className="h-4 w-4" /> Camadas de Visualizacao
                    </h4>
                    {/* Tile Layer Selection */}
                    <div className="space-y-1">
                      <Label className="text-xs">Mapa Base</Label>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(TILE_LAYERS).map(([key, cfg]) => (
                          <Badge
                            key={key}
                            variant={tileKey === key ? "default" : "outline"}
                            className="cursor-pointer text-xs"
                            onClick={() => setTileKey(key)}
                          >
                            {cfg.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {/* Annotation Layer Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="h-7 p-1" onClick={() => setShowAnnotationLayer(!showAnnotationLayer)}>
                          {showAnnotationLayer ? <Eye className="h-4 w-4 text-blue-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                        <span className="text-sm">Anotacoes ({annotations.length})</span>
                      </div>
                      <Select value={annotationFilter} onValueChange={setAnnotationFilter}>
                        <SelectTrigger className="h-7 w-[130px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os Tipos</SelectItem>
                          <SelectItem value="ponto">Ponto</SelectItem>
                          <SelectItem value="area">Area</SelectItem>
                          <SelectItem value="setor">Setor</SelectItem>
                          <SelectItem value="inspecao">Inspecao</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Constraint Layer Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="h-7 p-1" onClick={() => setShowConstraintLayer(!showConstraintLayer)}>
                          {showConstraintLayer ? <Eye className="h-4 w-4 text-red-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                        <span className="text-sm">Restricoes Lean ({mapConstraints.length})</span>
                      </div>
                    </div>
                    {/* Offline Cache */}
                    <div className="flex items-center justify-between border-t pt-2">
                      <div className="flex items-center gap-2 text-sm">
                        <WifiOff className="h-4 w-4 text-muted-foreground" />
                        <span>Cache Offline: {cachedTileCount} tiles</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={async () => {
                        await clearTileCache();
                        setCachedTileCount(0);
                        toast({ title: "Cache de tiles limpo!" });
                      }}>
                        Limpar Cache
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Map Display */}
              {mapMode === "leaflet" ? (
                <Card className="overflow-hidden" style={{ position: "relative", zIndex: 0 }}>
                  <div ref={leafletContainerRef} className="w-full h-[600px]" style={{ position: "relative", zIndex: 0 }} />
                </Card>
              ) : (
                <>
                  {!project?.interactive_map_url ? (
                    <Card className="border-dashed border-2">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Map className="h-16 w-16 text-muted-foreground mb-4" />
                        <h3 className="text-xl font-semibold font-mono mb-2">Nenhum Mapa QGIS Carregado</h3>
                        <p className="text-muted-foreground text-center mb-6 max-w-md">
                          Envie um ZIP do qgis2web ou use uma URL externa para visualizar aqui.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <Button onClick={() => fileInputRef.current?.click()}>
                            <FileArchive className="h-4 w-4 mr-2" />Upload ZIP (QGIS)
                          </Button>
                          <Button variant="outline" onClick={() => { setMapSourceType("url"); setShowMapSourceDialog(true); }}>
                            <Globe className="h-4 w-4 mr-2" />URL Externa
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="overflow-hidden animate-fade-in" style={{ position: "relative", zIndex: 0 }}>
                      <div className="relative" style={{ zIndex: 0 }}>
                        {signedMapUrl ? (
                          <iframe
                            ref={iframeRef}
                            src={signedMapUrl}
                            className="w-full h-[600px] border-0"
                            style={{ position: "relative", zIndex: 0 }}
                            title="Mapa Interativo"
                            allow="geolocation; fullscreen"
                          />
                        ) : (
                          <div className="w-full h-[600px] flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin" />
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                </>
              )}

              {isExternalUrl(project?.interactive_map_url) && !isStorageUrl(project?.interactive_map_url) && (
                <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                  <span>URL:</span>
                  <code className="bg-muted px-2 py-1 rounded text-xs max-w-md truncate">
                    {project?.interactive_map_url}
                  </code>
                  <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                    <a href={project?.interactive_map_url || ""} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              )}

              {/* Annotation Legend */}
              {annotations.length > 0 && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-medium">Legenda:</span>
                  {[
                    { tipo: "ponto", label: "Ponto" },
                    { tipo: "area", label: "Area" },
                    { tipo: "setor", label: "Setor" },
                    { tipo: "inspecao", label: "Inspecao" },
                  ].map(item => (
                    <span key={item.tipo} className="flex items-center gap-1">
                      <span className="w-3 h-3" style={{ backgroundColor: getAnnotationColor(item.tipo) }} />
                      {item.label}
                    </span>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="annotations" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold font-mono">Anotações do Mapa</h2>
                <Button onClick={() => setShowAddMarkerDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Anotação
                </Button>
              </div>

              {annotations.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma anotação adicionada ainda.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {annotations.map((annotation) => (
                    <Card key={annotation.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-base">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {annotation.tipo}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteAnnotationMutation.mutate(annotation.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {annotation.descricao && (
                          <p className="text-sm text-muted-foreground">{annotation.descricao}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-sm">Avanço:</span>
                          <span className={`font-bold ${getProgressColor(annotation.porcentagem)}`}>
                            {annotation.porcentagem}%
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Lat: {annotation.latitude.toFixed(6)}, Lng: {annotation.longitude.toFixed(6)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="embed" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    Embed / Plugin para Sites Externos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-muted-foreground">
                    Use os códigos abaixo para incorporar o mapa interativo em sites externos 
                    (ex: portais de transparência, sites da prefeitura, etc.)
                  </p>

                  {!project?.interactive_map_url ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Map className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Envie um mapa primeiro para obter o código de embed.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label className="font-semibold">URL Direta do Mapa</Label>
                        <p className="text-sm text-muted-foreground">
                          Use esta URL para acessar o mapa diretamente ou compartilhar.
                        </p>
                        <div className="flex gap-2">
                          <Input
                            readOnly
                            value={`${window.location.origin}/embed/map/${projectId}`}
                            className="font-mono text-sm"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/embed/map/${projectId}`);
                              toast({ title: "URL copiada!" });
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            asChild
                          >
                            <a href={`/embed/map/${projectId}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="font-semibold">Código iframe (Recomendado)</Label>
                        <p className="text-sm text-muted-foreground">
                          Cole este código no HTML do site onde deseja exibir o mapa.
                        </p>
                        <div className="relative">
                          <Textarea
                            readOnly
                            rows={4}
                            className="font-mono text-sm resize-none"
                            value={`<iframe 
  src="${window.location.origin}/embed/map/${projectId}"
  width="100%"
  height="600"
  style="border:none;"
  title="Mapa Interativo - ${project?.name || 'Projeto'}"
  allow="geolocation"
></iframe>`}
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => {
                              navigator.clipboard.writeText(`<iframe 
  src="${window.location.origin}/embed/map/${projectId}"
  width="100%"
  height="600"
  style="border:none;"
  title="Mapa Interativo - ${project?.name || 'Projeto'}"
  allow="geolocation"
></iframe>`);
                              toast({ title: "Código copiado!" });
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copiar
                          </Button>
                        </div>
                      </div>

                      <div className="bg-muted/50 p-4 rounded-none">
                        <h4 className="font-semibold mb-2">Dicas de Uso:</h4>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                          <li>O mapa será exibido com todas as camadas e interatividade</li>
                          <li>Funciona em qualquer site que aceite HTML/JavaScript</li>
                          <li>Responsivo - se adapta ao tamanho do container</li>
                          <li>Atualizações no mapa refletem automaticamente no embed</li>
                        </ul>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Dialog para URL Externa */}
          <Dialog open={showMapSourceDialog} onOpenChange={setShowMapSourceDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Adicionar Mapa por URL Externa
                </DialogTitle>
                <DialogDescription>
                  Cole a URL do mapa que deseja exibir. O mapa deve permitir embed via iframe.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>URL do Mapa</Label>
                  <Input
                    placeholder="https://exemplo.com/mapa ou https://arcgis.com/..."
                    value={externalMapUrl}
                    onChange={(e) => setExternalMapUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Exemplos: ArcGIS Online, Mapbox, Google MyMaps (embed), QGIS Cloud, etc.
                  </p>
                </div>

                <div className="bg-muted/50 p-3 rounded-none">
                  <h4 className="text-sm font-semibold mb-2">Dicas:</h4>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Use URLs de embed quando disponíveis</li>
                    <li>O mapa deve ser público ou permitir acesso anônimo</li>
                    <li>Evite URLs com autenticação obrigatória</li>
                  </ul>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowMapSourceDialog(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSaveExternalUrl}
                  disabled={saveExternalUrlMutation.isPending}
                >
                  {saveExternalUrlMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar URL
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog para Anotações */}
          <Dialog open={showAddMarkerDialog} onOpenChange={(open) => { setShowAddMarkerDialog(open); if (!open) setClickToAddMode(false); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Anotacao no Mapa</DialogTitle>
                <DialogDescription>
                  {newMarker.latitude !== 0 || newMarker.longitude !== 0
                    ? "Coordenadas capturadas do mapa. Ajuste se necessario."
                    : "Adicione uma anotacao com coordenadas e informacoes de progresso."
                  }
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Latitude</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      value={newMarker.latitude}
                      onChange={(e) => setNewMarker({ ...newMarker, latitude: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Longitude</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      value={newMarker.longitude}
                      onChange={(e) => setNewMarker({ ...newMarker, longitude: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={newMarker.tipo}
                    onValueChange={(v) => setNewMarker({ ...newMarker, tipo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ponto">Ponto</SelectItem>
                      <SelectItem value="area">Área</SelectItem>
                      <SelectItem value="setor">Setor</SelectItem>
                      <SelectItem value="inspecao">Inspeção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={newMarker.descricao}
                    onChange={(e) => setNewMarker({ ...newMarker, descricao: e.target.value })}
                    placeholder="Descrição da anotação..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Avanço (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={newMarker.porcentagem}
                    onChange={(e) => setNewMarker({ ...newMarker, porcentagem: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                {serviceFronts.length > 0 && (
                  <div className="space-y-2">
                    <Label>Frente de Serviço (Opcional)</Label>
                    <Select
                      value={newMarker.service_front_id || "none"}
                      onValueChange={(v) => setNewMarker({ ...newMarker, service_front_id: v === "none" ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {serviceFronts.map((sf: any) => (
                          <SelectItem key={sf.id} value={sf.id}>{sf.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddMarkerDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => addAnnotationMutation.mutate(newMarker)}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </SidebarProvider>
  );
}
