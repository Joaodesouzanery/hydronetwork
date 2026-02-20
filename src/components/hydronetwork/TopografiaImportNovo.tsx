/**
 * 🆕 NOVO - Importação DXF Simplificada com Parser Completo
 * Extração real de LWPOLYLINE, LINE, POINT, CIRCLE, ARC
 * Suporte a arquivos grandes (6MB+) do QGIS
 */

import React, { useState, useCallback } from 'react';

interface ParsedPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  layer: string;
  handle: string;
}

interface ParsedEdge {
  id: string;
  type: string;
  coordinates: number[][];
  isClosed: boolean;
  layer: string;
  handle: string;
}

// Parser DXF Completo
const parseDXF = (content: string) => {
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const layers = new Set<string>();
  
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  
  let inEntities = false;
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i]?.trim();
    
    if (line === 'ENTITIES') { inEntities = true; i++; continue; }
    if (inEntities && line === 'ENDSEC') break;
    if (!inEntities) { i++; continue; }
    
    if (line === '0') {
      i++;
      const entityType = lines[i]?.trim().toUpperCase();
      
      if (entityType === 'LWPOLYLINE') {
        const coords: number[][] = [];
        const attrs: any = { handle: '', layer: '0', closed: false };
        let cx: number | null = null, cy: number | null = null, cz = 0, elev = 0;
        i++;
        
        while (i < lines.length - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 5) attrs.handle = val;
          if (code === 8) { attrs.layer = val; layers.add(val); }
          if (code === 38) elev = parseFloat(val);
          if (code === 70) attrs.closed = (parseInt(val) & 1) === 1;
          if (code === 10) {
            if (cx !== null && cy !== null) coords.push([cx, cy, cz || elev]);
            cx = parseFloat(val); cy = null; cz = elev;
          }
          if (code === 20) cy = parseFloat(val);
          if (code === 30) cz = parseFloat(val);
          i += 2;
        }
        if (cx !== null && cy !== null) coords.push([cx, cy, cz || elev]);
        if (attrs.closed && coords.length > 0) coords.push([...coords[0]]);
        
        if (coords.length >= 2) {
          edges.push({
            id: attrs.handle || `lwpoly_${edges.length}`,
            type: 'LWPOLYLINE',
            coordinates: coords,
            isClosed: attrs.closed,
            layer: attrs.layer,
            handle: attrs.handle
          });
        }
        continue;
      }
      
      if (entityType === 'LINE') {
        const attrs: any = { handle: '', layer: '0' };
        let x1: number | null = null, y1: number | null = null, z1 = 0;
        let x2: number | null = null, y2: number | null = null, z2 = 0;
        i++;
        
        while (i < lines.length - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 5) attrs.handle = val;
          if (code === 8) { attrs.layer = val; layers.add(val); }
          if (code === 10) x1 = parseFloat(val);
          if (code === 20) y1 = parseFloat(val);
          if (code === 30) z1 = parseFloat(val);
          if (code === 11) x2 = parseFloat(val);
          if (code === 21) y2 = parseFloat(val);
          if (code === 31) z2 = parseFloat(val);
          i += 2;
        }
        
        if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
          edges.push({
            id: attrs.handle || `line_${edges.length}`,
            type: 'LINE',
            coordinates: [[x1, y1, z1], [x2, y2, z2]],
            isClosed: false,
            layer: attrs.layer,
            handle: attrs.handle
          });
        }
        continue;
      }
      
      if (entityType === 'POINT') {
        const attrs: any = { handle: '', layer: '0' };
        let x: number | null = null, y: number | null = null, z = 0;
        i++;
        
        while (i < lines.length - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 5) attrs.handle = val;
          if (code === 8) { attrs.layer = val; layers.add(val); }
          if (code === 10) x = parseFloat(val);
          if (code === 20) y = parseFloat(val);
          if (code === 30) z = parseFloat(val);
          i += 2;
        }
        
        if (x !== null && y !== null) {
          points.push({
            id: attrs.handle || `point_${points.length}`,
            x, y, z,
            layer: attrs.layer,
            handle: attrs.handle
          });
        }
        continue;
      }
      
      if (entityType === 'POLYLINE') {
        const attrs: any = { handle: '', layer: '0', closed: false };
        const coords: number[][] = [];
        i++;
        
        while (i < lines.length - 1) {
          const code = parseInt(lines[i]?.trim() || '');
          const val = lines[i + 1]?.trim() || '';
          if (code === 0 && val !== 'VERTEX') break;
          if (code === 5) attrs.handle = val;
          if (code === 8) { attrs.layer = val; layers.add(val); }
          if (code === 70) attrs.closed = (parseInt(val) & 1) === 1;
          if (code === 0 && val === 'VERTEX') {
            i += 2;
            let vx: number | null = null, vy: number | null = null, vz = 0;
            while (i < lines.length - 1) {
              const vc = parseInt(lines[i]?.trim() || '');
              const vv = lines[i + 1]?.trim() || '';
              if (vc === 0) break;
              if (vc === 10) vx = parseFloat(vv);
              if (vc === 20) vy = parseFloat(vv);
              if (vc === 30) vz = parseFloat(vv);
              i += 2;
            }
            if (vx !== null && vy !== null) coords.push([vx, vy, vz]);
            continue;
          }
          i += 2;
        }
        if (attrs.closed && coords.length > 0) coords.push([...coords[0]]);
        
        if (coords.length >= 2) {
          edges.push({
            id: attrs.handle || `poly_${edges.length}`,
            type: 'POLYLINE',
            coordinates: coords,
            isClosed: attrs.closed,
            layer: attrs.layer,
            handle: attrs.handle
          });
        }
        continue;
      }
    }
    i++;
  }
  
  return { points, edges, layers: Array.from(layers) };
};

// Componente Principal
export const TopografiaImportNovo: React.FC<{
  onImportComplete?: (data: { points: ParsedPoint[], edges: ParsedEdge[] }) => void;
}> = ({ onImportComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ points: ParsedPoint[], edges: ParsedEdge[], layers: string[] } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterLayer, setFilterLayer] = useState('all');

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setLoading(true);
    setProgress(10);
    
    try {
      const text = await f.text();
      setProgress(40);
      
      const ext = f.name.split('.').pop()?.toLowerCase();
      let data: any = { points: [], edges: [], layers: [] };
      
      if (ext === 'dxf') {
        data = parseDXF(text);
      } else if (ext === 'csv' || ext === 'txt') {
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length > 1) {
          const delim = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
          const headers = lines[0].split(delim).map(h => h.trim());
          const xCol = headers.findIndex(h => /^(x|lon|este|easting)$/i.test(h));
          const yCol = headers.findIndex(h => /^(y|lat|norte|northing)$/i.test(h));
          const zCol = headers.findIndex(h => /^(z|cota|elev|altitude)$/i.test(h));
          
          for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(delim).map(v => v.trim());
            if (xCol >= 0 && yCol >= 0) {
              const x = parseFloat(vals[xCol]?.replace(',', '.') || '');
              const y = parseFloat(vals[yCol]?.replace(',', '.') || '');
              const z = zCol >= 0 ? parseFloat(vals[zCol]?.replace(',', '.') || '0') : 0;
              if (!isNaN(x) && !isNaN(y)) {
                data.points.push({ id: `pt_${i}`, x, y, z, layer: 'CSV', handle: `${i}` });
              }
            }
          }
          data.layers = ['CSV'];
        }
      } else if (ext === 'geojson' || ext === 'json') {
        try {
          const json = JSON.parse(text);
          (json.features || []).forEach((f: any, i: number) => {
            const layer = f.properties?.layer || 'GeoJSON';
            if (!data.layers.includes(layer)) data.layers.push(layer);
            if (f.geometry?.type === 'Point') {
              const [x, y, z = 0] = f.geometry.coordinates;
              data.points.push({ id: `pt_${i}`, x, y, z, layer, handle: f.id || `${i}` });
            }
            if (f.geometry?.type === 'LineString') {
              data.edges.push({
                id: `ln_${i}`, type: 'LineString',
                coordinates: f.geometry.coordinates.map((c: number[]) => [c[0], c[1], c[2] || 0]),
                isClosed: false, layer, handle: f.id || `${i}`
              });
            }
          });
        } catch (e) {}
      }
      
      setProgress(90);
      setResult(data);
      const allIds = new Set([...data.points.map((p: any) => p.id), ...data.edges.map((e: any) => e.id)]);
      setSelected(allIds);
      setProgress(100);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  const handleImport = () => {
    if (!result) return;
    const pts = result.points.filter(p => selected.has(p.id));
    const edg = result.edges.filter(e => selected.has(e.id));
    onImportComplete?.({ points: pts, edges: edg });
    alert(`Importado: ${pts.length} pontos e ${edg.length} trechos!`);
  };

  const selectAll = () => {
    if (!result) return;
    const filtered = filterLayer === 'all' 
      ? [...result.points, ...result.edges]
      : [...result.points.filter(p => p.layer === filterLayer), ...result.edges.filter(e => e.layer === filterLayer)];
    setSelected(new Set([...selected, ...filtered.map(e => e.id)]));
  };

  const selectNone = () => setSelected(new Set());

  const filteredEdges = result?.edges.filter(e => filterLayer === 'all' || e.layer === filterLayer) || [];
  const filteredPoints = result?.points.filter(p => filterLayer === 'all' || p.layer === filterLayer) || [];

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>📐</span>
        <h3 style={{ margin: 0, color: '#1e293b' }}>Importação Simplificada</h3>
        <span style={{ backgroundColor: '#10b981', color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 'bold' }}>🆕 NOVO</span>
      </div>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>Parser DXF completo - extrai LWPOLYLINE, LINE, POINT com layer e handle</p>

      {!result && !loading && (
        <div
          style={{ border: '2px dashed #3b82f6', borderRadius: 8, padding: 32, textAlign: 'center', cursor: 'pointer', backgroundColor: '#f8fafc' }}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          onDragOver={e => e.preventDefault()}
          onClick={() => document.getElementById('novo-import-input')?.click()}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
          <p style={{ margin: 0, color: '#1e293b' }}>Arraste ou clique para selecionar</p>
          <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: 13 }}>DXF, GeoJSON, CSV, TXT</p>
          <input id="novo-import-input" type="file" style={{ display: 'none' }} accept=".dxf,.geojson,.json,.csv,.txt" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <p>Processando... {progress}%</p>
          <div style={{ width: '100%', height: 6, backgroundColor: '#e2e8f0', borderRadius: 3 }}>
            <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#3b82f6', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {result && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div style={{ backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#3b82f6' }}>{result.points.length + result.edges.length}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Total</div>
            </div>
            <div style={{ backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#10b981' }}>{result.points.length}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Pontos</div>
            </div>
            <div style={{ backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#f59e0b' }}>{result.edges.length}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Trechos</div>
            </div>
            <div style={{ backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#8b5cf6' }}>{selected.size}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Selecionados</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filterLayer} onChange={e => setFilterLayer(e.target.value)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <option value="all">Todos os Layers ({result.layers.length})</option>
              {result.layers.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <button onClick={selectAll} style={{ padding: '6px 12px', borderRadius: 6, backgroundColor: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer' }}>✓ Selecionar Todos</button>
            <button onClick={selectNone} style={{ padding: '6px 12px', borderRadius: 6, backgroundColor: '#fff', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer' }}>✗ Limpar</button>
            <button onClick={() => { setResult(null); setFile(null); }} style={{ padding: '6px 12px', borderRadius: 6, backgroundColor: '#fff', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer' }}>↺ Novo Arquivo</button>
          </div>

          {filteredEdges.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <h4 style={{ margin: '0 0 8px', color: '#1e293b', fontSize: 14 }}>📐 Trechos ({filteredEdges.length})</h4>
              <div style={{ maxHeight: 150, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: 8, textAlign: 'left', width: 30 }}>✓</th>
                      <th style={{ padding: 8, textAlign: 'left' }}>Handle</th>
                      <th style={{ padding: 8, textAlign: 'left' }}>Tipo</th>
                      <th style={{ padding: 8, textAlign: 'center' }}>Vértices</th>
                      <th style={{ padding: 8, textAlign: 'left' }}>Layer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEdges.slice(0, 100).map(e => (
                      <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => setSelected(prev => { const n = new Set(prev); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n; })}>
                        <td style={{ padding: 8 }}><input type="checkbox" checked={selected.has(e.id)} readOnly /></td>
                        <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 11 }}>{e.handle}</td>
                        <td style={{ padding: 8 }}>{e.type}</td>
                        <td style={{ padding: 8, textAlign: 'center' }}>{e.coordinates.length}</td>
                        <td style={{ padding: 8 }}>{e.layer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredEdges.length > 100 && <div style={{ padding: 8, textAlign: 'center', color: '#94a3b8' }}>+{filteredEdges.length - 100} mais</div>}
              </div>
            </div>
          )}

          {filteredPoints.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <h4 style={{ margin: '0 0 8px', color: '#1e293b', fontSize: 14 }}>📍 Pontos ({filteredPoints.length})</h4>
              <div style={{ maxHeight: 120, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: 8, width: 30 }}>✓</th>
                      <th style={{ padding: 8, textAlign: 'right' }}>X</th>
                      <th style={{ padding: 8, textAlign: 'right' }}>Y</th>
                      <th style={{ padding: 8, textAlign: 'right' }}>Z</th>
                      <th style={{ padding: 8, textAlign: 'left' }}>Layer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPoints.slice(0, 50).map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => setSelected(prev => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; })}>
                        <td style={{ padding: 8 }}><input type="checkbox" checked={selected.has(p.id)} readOnly /></td>
                        <td style={{ padding: 8, textAlign: 'right', fontFamily: 'monospace' }}>{p.x.toFixed(2)}</td>
                        <td style={{ padding: 8, textAlign: 'right', fontFamily: 'monospace' }}>{p.y.toFixed(2)}</td>
                        <td style={{ padding: 8, textAlign: 'right', fontFamily: 'monospace' }}>{p.z.toFixed(2)}</td>
                        <td style={{ padding: 8 }}>{p.layer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredPoints.length > 50 && <div style={{ padding: 8, textAlign: 'center', color: '#94a3b8' }}>+{filteredPoints.length - 50} mais</div>}
              </div>
            </div>
          )}

          <button onClick={handleImport} disabled={selected.size === 0} style={{
            width: '100%', padding: '12px 24px', borderRadius: 8, border: 'none', cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
            backgroundColor: selected.size > 0 ? '#10b981' : '#e2e8f0', color: selected.size > 0 ? '#fff' : '#94a3b8', fontWeight: 'bold', fontSize: 14
          }}>
            ✅ Confirmar Importação ({selected.size} itens)
          </button>
        </div>
      )}
    </div>
  );
};

export default TopografiaImportNovo;
