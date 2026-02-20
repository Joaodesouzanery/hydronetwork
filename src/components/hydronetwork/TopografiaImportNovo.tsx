import React, { useState, useCallback } from 'react';

interface ParsedPoint { id: string; x: number; y: number; z: number; layer: string; handle: string; }
interface ParsedEdge { id: string; type: string; coordinates: number[][]; isClosed: boolean; layer: string; handle: string; }

const parseDXF = (content: string) => {
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];
  const layers = new Set<string>();
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let inEntities = false, i = 0;

  while (i < lines.length) {
    const line = lines[i]?.trim();
    if (line === 'ENTITIES') { inEntities = true; i++; continue; }
    if (inEntities && line === 'ENDSEC') break;
    if (!inEntities) { i++; continue; }

    if (line === '0') {
      i++;
      const type = lines[i]?.trim().toUpperCase();

      if (type === 'LWPOLYLINE') {
        const coords: number[][] = [];
        let handle = '', layer = '0', closed = false, cx: number | null = null, cy: number | null = null, cz = 0, elev = 0;
        i++;
        while (i < lines.length - 1) {
          const code = parseInt(lines[i]?.trim() || ''), val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 5) handle = val;
          if (code === 8) { layer = val; layers.add(val); }
          if (code === 38) elev = parseFloat(val);
          if (code === 70) closed = (parseInt(val) & 1) === 1;
          if (code === 10) { if (cx !== null && cy !== null) coords.push([cx, cy, cz || elev]); cx = parseFloat(val); cy = null; cz = elev; }
          if (code === 20) cy = parseFloat(val);
          if (code === 30) cz = parseFloat(val);
          i += 2;
        }
        if (cx !== null && cy !== null) coords.push([cx, cy, cz || elev]);
        if (closed && coords.length > 0) coords.push([...coords[0]]);
        if (coords.length >= 2) edges.push({ id: handle || `lw_${edges.length}`, type: 'LWPOLYLINE', coordinates: coords, isClosed: closed, layer, handle });
        continue;
      }

      if (type === 'LINE') {
        let handle = '', layer = '0', x1: number | null = null, y1: number | null = null, z1 = 0, x2: number | null = null, y2: number | null = null, z2 = 0;
        i++;
        while (i < lines.length - 1) {
          const code = parseInt(lines[i]?.trim() || ''), val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 5) handle = val;
          if (code === 8) { layer = val; layers.add(val); }
          if (code === 10) x1 = parseFloat(val);
          if (code === 20) y1 = parseFloat(val);
          if (code === 30) z1 = parseFloat(val);
          if (code === 11) x2 = parseFloat(val);
          if (code === 21) y2 = parseFloat(val);
          if (code === 31) z2 = parseFloat(val);
          i += 2;
        }
        if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) edges.push({ id: handle || `ln_${edges.length}`, type: 'LINE', coordinates: [[x1, y1, z1], [x2, y2, z2]], isClosed: false, layer, handle });
        continue;
      }

      if (type === 'POINT') {
        let handle = '', layer = '0', x: number | null = null, y: number | null = null, z = 0;
        i++;
        while (i < lines.length - 1) {
          const code = parseInt(lines[i]?.trim() || ''), val = lines[i + 1]?.trim() || '';
          if (code === 0) break;
          if (code === 5) handle = val;
          if (code === 8) { layer = val; layers.add(val); }
          if (code === 10) x = parseFloat(val);
          if (code === 20) y = parseFloat(val);
          if (code === 30) z = parseFloat(val);
          i += 2;
        }
        if (x !== null && y !== null) points.push({ id: handle || `pt_${points.length}`, x, y, z, layer, handle });
        continue;
      }

      if (type === 'POLYLINE') {
        let handle = '', layer = '0', closed = false;
        const coords: number[][] = [];
        i++;
        while (i < lines.length - 1) {
          const code = parseInt(lines[i]?.trim() || ''), val = lines[i + 1]?.trim() || '';
          if (code === 0 && val === 'SEQEND') { i += 2; break; }
          if (code === 5) handle = val;
          if (code === 8) { layer = val; layers.add(val); }
          if (code === 70) closed = (parseInt(val) & 1) === 1;
          if (code === 0 && val === 'VERTEX') {
            i += 2;
            let vx: number | null = null, vy: number | null = null, vz = 0;
            while (i < lines.length - 1) {
              const vc = parseInt(lines[i]?.trim() || ''), vv = lines[i + 1]?.trim() || '';
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
        if (closed && coords.length > 0) coords.push([...coords[0]]);
        if (coords.length >= 2) edges.push({ id: handle || `pl_${edges.length}`, type: 'POLYLINE', coordinates: coords, isClosed: closed, layer, handle });
        continue;
      }
    }
    i++;
  }
  return { points, edges, layers: Array.from(layers) };
};

export const TopografiaImportNovo: React.FC<{ onImportComplete?: (data: any) => void }> = ({ onImportComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ points: ParsedPoint[], edges: ParsedEdge[], layers: string[] } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterLayer, setFilterLayer] = useState('all');

  const handleFile = useCallback(async (f: File) => {
    setFile(f); setLoading(true); setProgress(10);
    const text = await f.text(); setProgress(40);
    const ext = f.name.split('.').pop()?.toLowerCase();
    let data: any = { points: [], edges: [], layers: [] };
    if (ext === 'dxf') data = parseDXF(text);
    else if (ext === 'csv' || ext === 'txt') {
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length > 1) {
        const delim = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(delim).map(h => h.trim());
        const xCol = headers.findIndex(h => /^(x|lon|este)$/i.test(h));
        const yCol = headers.findIndex(h => /^(y|lat|norte)$/i.test(h));
        const zCol = headers.findIndex(h => /^(z|cota|elev)$/i.test(h));
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(delim).map(v => v.trim());
          if (xCol >= 0 && yCol >= 0) {
            const x = parseFloat(vals[xCol]?.replace(',', '.') || '');
            const y = parseFloat(vals[yCol]?.replace(',', '.') || '');
            const z = zCol >= 0 ? parseFloat(vals[zCol]?.replace(',', '.') || '0') : 0;
            if (!isNaN(x) && !isNaN(y)) data.points.push({ id: `pt_${i}`, x, y, z, layer: 'CSV', handle: `${i}` });
          }
        }
        data.layers = ['CSV'];
      }
    }
    setProgress(90); setResult(data);
    setSelected(new Set([...data.points.map((p: any) => p.id), ...data.edges.map((e: any) => e.id)]));
    setProgress(100); setLoading(false);
  }, []);

  const handleImport = () => {
    if (!result) return;
    onImportComplete?.({ points: result.points.filter(p => selected.has(p.id)), edges: result.edges.filter(e => selected.has(e.id)) });
  };

  const selectAll = () => { if (result) setSelected(new Set([...result.points.map(p => p.id), ...result.edges.map(e => e.id)])); };
  const filteredEdges = result?.edges.filter(e => filterLayer === 'all' || e.layer === filterLayer) || [];
  const filteredPoints = result?.points.filter(p => filterLayer === 'all' || p.layer === filterLayer) || [];

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>📐</span>
        <h3 style={{ margin: 0, fontSize: 16, color: '#1e293b' }}>Importação Simplificada</h3>
        <span style={{ backgroundColor: '#10b981', color: '#fff', padding: '2px 10px', borderRadius: 12, fontSize: 10, fontWeight: 'bold' }}>🆕 NOVO</span>
      </div>
      <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 12px' }}>Parser DXF completo - extrai LWPOLYLINE, LINE, POINT</p>

      {!result && !loading && (
        <div style={{ border: '2px dashed #3b82f6', borderRadius: 8, padding: 24, textAlign: 'center', cursor: 'pointer', backgroundColor: '#f8fafc' }}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          onDragOver={e => e.preventDefault()}
          onClick={() => document.getElementById('novo-import')?.click()}>
          <div style={{ fontSize: 28 }}>📂</div>
          <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 13 }}>Arraste DXF, CSV, GeoJSON</p>
          <input id="novo-import" type="file" style={{ display: 'none' }} accept=".dxf,.csv,.txt,.geojson,.json" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <p style={{ margin: '0 0 8px' }}>⏳ Processando... {progress}%</p>
          <div style={{ height: 4, backgroundColor: '#e2e8f0', borderRadius: 2 }}>
            <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#3b82f6', borderRadius: 2 }} />
          </div>
        </div>
      )}

      {result && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            <div style={{ backgroundColor: '#f1f5f9', padding: 10, borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: '#10b981' }}>{result.points.length}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Pontos</div>
            </div>
            <div style={{ backgroundColor: '#f1f5f9', padding: 10, borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: '#f59e0b' }}>{result.edges.length}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Trechos</div>
            </div>
            <div style={{ backgroundColor: '#f1f5f9', padding: 10, borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: '#8b5cf6' }}>{selected.size}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Selecionados</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <select value={filterLayer} onChange={e => setFilterLayer(e.target.value)} style={{ padding: '4px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #e2e8f0' }}>
              <option value="all">Todos Layers</option>
              {result.layers.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <button onClick={selectAll} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 4, backgroundColor: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer' }}>Selecionar Todos</button>
            <button onClick={() => setSelected(new Set())} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 4, backgroundColor: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer' }}>Limpar</button>
            <button onClick={() => { setResult(null); setFile(null); }} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 4, backgroundColor: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer' }}>Novo Arquivo</button>
          </div>

          {filteredEdges.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>📐 Trechos ({filteredEdges.length})</div>
              <div style={{ maxHeight: 100, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 11 }}>
                {filteredEdges.slice(0, 50).map(e => (
                  <div key={e.id} style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                    onClick={() => setSelected(p => { const n = new Set(p); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n; })}>
                    <input type="checkbox" checked={selected.has(e.id)} readOnly />
                    <span style={{ fontFamily: 'monospace' }}>{e.handle}</span>
                    <span>{e.type}</span>
                    <span style={{ color: '#64748b' }}>{e.coordinates.length} vértices</span>
                    <span style={{ color: '#94a3b8' }}>{e.layer}</span>
                  </div>
                ))}
                {filteredEdges.length > 50 && <div style={{ padding: 4, textAlign: 'center', color: '#94a3b8' }}>+{filteredEdges.length - 50} mais</div>}
              </div>
            </div>
          )}

          <button onClick={handleImport} disabled={selected.size === 0} style={{
            width: '100%', padding: '10px', borderRadius: 6, border: 'none', cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
            backgroundColor: selected.size > 0 ? '#10b981' : '#e2e8f0', color: selected.size > 0 ? '#fff' : '#94a3b8', fontWeight: 'bold', fontSize: 13
          }}>
            ✅ Importar ({selected.size})
          </button>
        </div>
      )}
    </div>
  );
};

export default TopografiaImportNovo;
