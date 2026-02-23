import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CONSTRAINT_TYPES, type LpsConstraint, STATUS_LABELS } from '@/types/lean-constraints';

interface ConstraintMapLayerProps {
  constraints: LpsConstraint[];
}

const STATUS_COLORS: Record<string, string> = {
  ativa: '#f59e0b',
  critica: '#ef4444',
  resolvida: '#22c55e',
};

export function ConstraintMapLayer({ constraints }: ConstraintMapLayerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([-15.7801, -47.9292], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const geoConstraints = constraints.filter(c => c.latitude != null && c.longitude != null);

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

  return (
    <div ref={mapRef} className="w-full h-[500px] rounded-md border" />
  );
}
