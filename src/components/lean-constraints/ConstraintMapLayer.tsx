import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CONSTRAINT_TYPES, type LpsConstraint, STATUS_LABELS } from '@/types/lean-constraints';
import { MapPin, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ConstraintMapLayerProps {
  constraints: LpsConstraint[];
  onCreateAtLocation?: (lat: number, lng: number) => void;
}

const STATUS_COLORS: Record<string, string> = {
  ativa: '#f59e0b',
  critica: '#ef4444',
  resolvida: '#22c55e',
};

export function ConstraintMapLayer({ constraints, onCreateAtLocation }: ConstraintMapLayerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [placingMode, setPlacingMode] = useState(false);
  const placingModeRef = useRef(false);

  const geoConstraints = constraints.filter(c => c.latitude != null && c.longitude != null);

  useEffect(() => {
    placingModeRef.current = placingMode;
  }, [placingMode]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const defaultCenter: [number, number] = geoConstraints.length > 0
      ? [geoConstraints[0].latitude!, geoConstraints[0].longitude!]
      : [-15.7801, -47.9292];

    const map = L.map(mapRef.current).setView(defaultCenter, 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (placingModeRef.current && onCreateAtLocation) {
        onCreateAtLocation(e.latlng.lat, e.latlng.lng);
        setPlacingMode(false);
        toast.success(`Localização selecionada: ${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (placingMode) {
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.getContainer().style.cursor = '';
    }
  }, [placingMode]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const markers: L.CircleMarker[] = [];

    for (const c of geoConstraints) {
      const color = STATUS_COLORS[c.status] || '#6b7280';
      const radius = c.status === 'critica' ? 10 : c.status === 'ativa' ? 8 : 6;

      const marker = L.circleMarker([c.latitude!, c.longitude!], {
        radius,
        fillColor: color,
        color: color,
        weight: 2,
        opacity: 1,
        fillOpacity: 0.7,
        className: c.status === 'critica' ? 'pulse-marker' : '',
      }).addTo(map);

      marker.bindPopup(`
        <div style="min-width:200px">
          <strong>${CONSTRAINT_TYPES[c.tipo_restricao]}</strong><br/>
          <span style="color:${color}">${STATUS_LABELS[c.status]}</span><br/>
          <hr style="margin:4px 0"/>
          <small>${c.descricao}</small><br/>
          ${c.employees?.name || c.responsavel_nome ? `<small><strong>Resp:</strong> ${c.employees?.name || c.responsavel_nome}</small><br/>` : ''}
          <small><strong>Data:</strong> ${c.data_identificacao}</small>
        </div>
      `);

      markers.push(marker);
    }

    if (geoConstraints.length > 0) {
      const bounds = L.latLngBounds(
        geoConstraints.map(c => [c.latitude!, c.longitude!] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {
      markers.forEach(m => m.remove());
    };
  }, [constraints]);

  if (geoConstraints.length === 0 && !onCreateAtLocation) {
    return (
      <div className="w-full h-[500px] rounded-md border flex flex-col items-center justify-center gap-3 text-muted-foreground bg-muted/30">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <MapPin className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="font-medium text-foreground">Nenhuma restrição geolocalizada</p>
        <p className="text-sm text-center max-w-sm">
          Ao criar restrições com coordenadas (latitude/longitude), elas aparecerão neste mapa.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500" /> Críticas ({geoConstraints.filter(c => c.status === 'critica').length})
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-500" /> Ativas ({geoConstraints.filter(c => c.status === 'ativa').length})
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500" /> Resolvidas ({geoConstraints.filter(c => c.status === 'resolvida').length})
          </div>
        </div>
        {onCreateAtLocation && (
          <Button
            size="sm"
            variant={placingMode ? 'destructive' : 'default'}
            onClick={() => setPlacingMode(!placingMode)}
          >
            {placingMode ? (
              <>Cancelar posicionamento</>
            ) : (
              <><Plus className="h-4 w-4 mr-1" /> Nova no mapa</>
            )}
          </Button>
        )}
      </div>
      {placingMode && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-sm p-2 rounded-md">
          Clique no mapa para posicionar a nova restrição. O formulário de criação abrirá com as coordenadas preenchidas.
        </div>
      )}
      <div ref={mapRef} className="w-full h-[500px] rounded-md border" />
    </div>
  );
}
