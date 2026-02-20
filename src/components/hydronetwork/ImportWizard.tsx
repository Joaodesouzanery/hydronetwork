/**
 * 🆕 NOVO - Importação Simplificada para Topografia
 * Leitura integral de TODOS os campos do arquivo
 * Foco em trechos (polilinhas) e pontos
 */

import React, { useState, useCallback, useEffect } from 'react';

interface ImportWizardProps {
  onComplete: (result: ImportResult) => void;
  onCancel: () => void;
  initialFile?: File;
}

interface ImportResult {
  success: boolean;
  fileName: string;
  points: ParsedPoint[];
  edges: ParsedEdge[];
  allFields: string[];
  rawEntities: any[];
}

interface ParsedPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  attributes: Record<string, any>;
}

interface ParsedEdge {
  id: string;
  coordinates: number[][];
  attributes: Record<string, any>;
}

interface FieldMapping {
  [key: string]: string;
}

// ============================================================================
// PARSER COMPLETO - Lê TODOS os campos de TODOS os formatos
// ============================================================================

const parseFileComplete = async (file: File): Promise<{
  entities: any[];
  allFields: string[];
  points: ParsedPoint[];
  edges: ParsedEdge[];
  fileType: string;
}> => {
  const text = await file.text();
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const entities: any[] = [];
  const allFieldsSet = new Set<string>();
  const points: ParsedPoint[] = [];
  const edges: ParsedEdge[] = [];

  // ========== PARSER CSV/TXT ==========
  if (ext === 'csv' || ext === 'txt') {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length > 1) {
      // Detectar delimitador
      const firstLine = lines[0];
      const delimiter = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';
      const headers = firstLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
      
      headers.forEach(h => allFieldsSet.add(h));

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter).map(v => v.trim().replace(/"/g, ''));
        const attrs: Record<string, any> = {};
        headers.forEach((h, j) => { 
          attrs[h] = values[j] || ''; 
        });
        
        const entity = {
          id: attrs['id'] || attrs['ID'] || attrs['Id'] || attrs['codigo'] || attrs['CODIGO'] || `row_${i}`,
          type: 'CSV_ROW',
          attributes: attrs,
          rawLine: lines[i]
        };
        entities.push(entity);

        // Detectar se é ponto (tem X, Y)
        const xField = headers.find(h => /^(x|coord_?x|longitude|lon|este|easting|e)$/i.test(h));
        const yField = headers.find(h => /^(y|coord_?y|latitude|lat|norte|northing|n)$/i.test(h));
        const zField = headers.find(h => /^(z|coord_?z|cota|elevation|elev|altitude|alt|h)$/i.test(h));

        if (xField && yField) {
          const x = parseFloat(String(attrs[xField]).replace(',', '.')) || 0;
          const y = parseFloat(String(attrs[yField]).replace(',', '.')) || 0;
          const z = zField ? parseFloat(String(attrs[zField]).replace(',', '.')) || 0 : 0;
          
          if (!isNaN(x) && !isNaN(y) && x !== 0 && y !== 0) {
            points.push({ id: entity.id, x, y, z, attributes: attrs });
          }
        }

        // Detectar se é trecho (tem X_INI, Y_INI, X_FIM, Y_FIM)
        const xIniField = headers.find(h => /^(x_?ini|x_?inicio|x_?start|x1|x_?mont)$/i.test(h));
        const yIniField = headers.find(h => /^(y_?ini|y_?inicio|y_?start|y1|y_?mont)$/i.test(h));
        const xFimField = headers.find(h => /^(x_?fim|x_?end|x2|x_?jus)$/i.test(h));
        const yFimField = headers.find(h => /^(y_?fim|y_?end|y2|y_?jus)$/i.test(h));

        if (xIniField && yIniField && xFimField && yFimField) {
          const x1 = parseFloat(String(attrs[xIniField]).replace(',', '.')) || 0;
          const y1 = parseFloat(String(attrs[yIniField]).replace(',', '.')) || 0;
          const x2 = parseFloat(String(attrs[xFimField]).replace(',', '.')) || 0;
          const y2 = parseFloat(String(attrs[yFimField]).replace(',', '.')) || 0;

          if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
            edges.push({
              id: entity.id,
              coordinates: [[x1, y1, 0], [x2, y2, 0]],
              attributes: attrs
            });
          }
        }
      }
    }
  }

  // ========== PARSER GEOJSON ==========
  else if (ext === 'geojson' || ext === 'json') {
    try {
      const json = JSON.parse(text);
      const features = json.features || (json.type === 'Feature' ? [json] : []);
      
      features.forEach((f: any, i: number) => {
        const attrs = f.properties || {};
        Object.keys(attrs).forEach(k => allFieldsSet.add(k));
        
        const entity = {
          id: f.id || attrs.id || attrs.ID || `feature_${i}`,
          type: f.geometry?.type || 'Unknown',
          geometry: f.geometry,
          attributes: attrs
        };
        entities.push(entity);

        // Extrair pontos
        if (f.geometry?.type === 'Point' && f.geometry.coordinates) {
          const [x, y, z = 0] = f.geometry.coordinates;
          points.push({ id: entity.id, x, y, z, attributes: attrs });
        }

        // Extrair trechos (LineString, MultiLineString)
        if (f.geometry?.type === 'LineString' && f.geometry.coordinates) {
          edges.push({
            id: entity.id,
            coordinates: f.geometry.coordinates.map((c: number[]) => [c[0], c[1], c[2] || 0]),
            attributes: attrs
          });
        }

        if (f.geometry?.type === 'MultiLineString' && f.geometry.coordinates) {
          f.geometry.coordinates.forEach((line: number[][], li: number) => {
            edges.push({
              id: `${entity.id}_line_${li}`,
              coordinates: line.map((c: number[]) => [c[0], c[1], c[2] || 0]),
              attributes: attrs
            });
          });
        }

        // Extrair polígonos como trechos fechados
        if (f.geometry?.type === 'Polygon' && f.geometry.coordinates) {
          f.geometry.coordinates.forEach((ring: number[][], ri: number) => {
            edges.push({
              id: `${entity.id}_ring_${ri}`,
              coordinates: ring.map((c: number[]) => [c[0], c[1], c[2] || 0]),
              attributes: attrs
            });
          });
        }
      });
    } catch (e) {
      console.error('Erro ao parsear GeoJSON:', e);
    }
  }

  // ========== PARSER DXF COMPLETO ==========
  else if (ext === 'dxf') {
    // Adicionar campos padrão DXF
    ['layer', 'type', 'handle', 'color', 'lineType'].forEach(f => allFieldsSet.add(f));

    // Parser DXF mais completo
    const sections = text.split(/\n\s*0\n/);
    let entityId = 0;

    for (const section of sections) {
      const lines = section.split('\n');
      const entityType = lines[0]?.trim().toUpperCase();

      if (['LINE', 'LWPOLYLINE', 'POLYLINE', 'POINT', 'CIRCLE', 'ARC', 'TEXT', 'MTEXT', 'INSERT', 'SPLINE', '3DFACE', '3DPOLYLINE'].includes(entityType)) {
        const attrs: Record<string, any> = { type: entityType };
        const coords: number[][] = [];
        let currentX: number | null = null;
        let currentY: number | null = null;
        let currentZ: number | null = null;

        for (let i = 0; i < lines.length - 1; i += 2) {
          const code = parseInt(lines[i]?.trim() || '0');
          const value = lines[i + 1]?.trim() || '';

          // Códigos DXF comuns
          if (code === 8) attrs['layer'] = value;
          if (code === 5) attrs['handle'] = value;
          if (code === 62) attrs['color'] = parseInt(value);
          if (code === 6) attrs['lineType'] = value;
          if (code === 48) attrs['lineScale'] = parseFloat(value);
          if (code === 370) attrs['lineWeight'] = parseInt(value);

          // Coordenadas
          if (code === 10) currentX = parseFloat(value);
          if (code === 20) currentY = parseFloat(value);
          if (code === 30) currentZ = parseFloat(value) || 0;
          if (code === 11) { // Segunda coordenada (para LINE)
            if (currentX !== null && currentY !== null) {
              coords.push([currentX, currentY, currentZ || 0]);
            }
            currentX = parseFloat(value);
          }
          if (code === 21) currentY = parseFloat(value);
          if (code === 31) currentZ = parseFloat(value) || 0;

          // Para LWPOLYLINE - múltiplos pontos
          if (entityType === 'LWPOLYLINE' && code === 10) {
            if (currentX !== null && currentY !== null) {
              coords.push([currentX, currentY, currentZ || 0]);
            }
            currentX = parseFloat(value);
            currentY = null;
            currentZ = null;
          }
        }

        // Adicionar última coordenada
        if (currentX !== null && currentY !== null) {
          coords.push([currentX, currentY, currentZ || 0]);
        }

        Object.keys(attrs).forEach(k => allFieldsSet.add(k));

        const entity = {
          id: attrs['handle'] || `dxf_${entityId++}`,
          type: entityType,
          coordinates: coords,
          attributes: attrs
        };
        entities.push(entity);

        // Classificar como ponto ou trecho
        if (entityType === 'POINT' && coords.length > 0) {
          points.push({
            id: entity.id,
            x: coords[0][0],
            y: coords[0][1],
            z: coords[0][2] || 0,
            attributes: attrs
          });
        } else if (['LINE', 'LWPOLYLINE', 'POLYLINE', 'SPLINE', '3DPOLYLINE'].includes(entityType) && coords.length >= 2) {
          edges.push({
            id: entity.id,
            coordinates: coords,
            attributes: attrs
          });
        }
      }
    }
  }

  // ========== PARSER SHAPEFILE (via GeoJSON convertido) ==========
  else if (ext === 'shp') {
    // Shapefile precisa de conversão externa, mas tentamos ler o que for possível
    allFieldsSet.add('shp_info');
    entities.push({
      id: 'shp_file',
      type: 'SHAPEFILE',
      attributes: { 
        shp_info: 'Arquivo Shapefile detectado. Para leitura completa, converta para GeoJSON.',
        fileName: file.name,
        fileSize: file.size
      }
    });
  }

  return {
    entities,
    allFields: Array.from(allFieldsSet).sort(),
    points,
    edges,
    fileType: ext.toUpperCase()
  };
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export const ImportWizard: React.FC<ImportWizardProps> = ({ onComplete, onCancel, initialFile }) => {
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<{
    entities: any[];
    allFields: string[];
    points: ParsedPoint[];
    edges: ParsedEdge[];
    fileType: string;
  } | null>(null);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());

  // Parse automático quando arquivo é selecionado
  useEffect(() => {
    if (file) {
      handleParse(file);
    }
  }, [file]);

  const handleParse = async (f: File) => {
    setLoading(true);
    setError(null);
    try {
      const result = await parseFileComplete(f);
      setParseResult(result);
      
      // Selecionar todas as entidades por padrão
      const allIds = new Set([
        ...result.points.map(p => p.id),
        ...result.edges.map(e => e.id)
      ]);
      setSelectedEntities(allIds);
    } catch (err: any) {
      setError(`Erro ao ler arquivo: ${err.message}`);
    }
    setLoading(false);
  };

  const handleFileSelect = (files: FileList | File[]) => {
    const f = Array.from(files)[0];
    if (f) setFile(f);
  };

  const handleImport = () => {
    if (!parseResult || !file) return;

    const selectedPoints = parseResult.points.filter(p => selectedEntities.has(p.id));
    const selectedEdges = parseResult.edges.filter(e => selectedEntities.has(e.id));

    onComplete({
      success: true,
      fileName: file.name,
      points: selectedPoints,
      edges: selectedEdges,
      allFields: parseResult.allFields,
      rawEntities: parseResult.entities
    });
  };

  const toggleEntity = (id: string) => {
    setSelectedEntities(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!parseResult) return;
    const allIds = new Set([
      ...parseResult.points.map(p => p.id),
      ...parseResult.edges.map(e => e.id)
    ]);
    setSelectedEntities(allIds);
  };

  const selectNone = () => setSelectedEntities(new Set());

  return (
    <div style={{ 
      padding: 24, 
      backgroundColor: '#0f172a', 
      borderRadius: 12, 
      color: '#e2e8f0', 
      minWidth: 800,
      maxHeight: '90vh',
      overflow: 'auto'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>📁 Importação - Topografia</h2>
          <span style={{ 
            backgroundColor: '#10b981', 
            color: '#fff', 
            padding: '4px 12px', 
            borderRadius: 20, 
            fontSize: 12, 
            fontWeight: 'bold',
            animation: 'pulse 2s infinite'
          }}>
            🆕 NOVO
          </span>
        </div>
        {file && (
          <span style={{ color: '#94a3b8' }}>
            {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </span>
        )}
      </div>

      {/* Área de Upload */}
      {!parseResult && (
        <div
          style={{
            border: '2px dashed #3b82f6',
            borderRadius: 12,
            padding: 60,
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: '#1e293b',
            marginBottom: 20
          }}
          onDrop={e => { e.preventDefault(); handleFileSelect(e.dataTransfer.files); }}
          onDragOver={e => e.preventDefault()}
          onClick={() => document.getElementById('import-file-input')?.click()}
        >
          {loading ? (
            <div>
              <div style={{ fontSize: 40, marginBottom: 10 }}>⏳</div>
              <p>Analisando arquivo... Lendo TODOS os campos...</p>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📂</div>
              <p style={{ fontSize: 18, marginBottom: 8 }}>Arraste ou clique para selecionar</p>
              <p style={{ color: '#94a3b8' }}>Formatos: DXF, GeoJSON, CSV, TXT, SHP</p>
            </div>
          )}
          <input
            id="import-file-input"
            type="file"
            style={{ display: 'none' }}
            accept=".dxf,.geojson,.json,.csv,.txt,.shp"
            onChange={e => e.target.files && handleFileSelect(e.target.files)}
          />
        </div>
      )}

      {/* Erro */}
      {error && (
        <div style={{ 
          padding: 16, 
          backgroundColor: '#dc262622', 
          border: '1px solid #dc2626', 
          borderRadius: 8, 
          marginBottom: 20 
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Resultado do Parse */}
      {parseResult && (
        <div>
          {/* Resumo */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: 12, 
            marginBottom: 20 
          }}>
            <div style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, color: '#3b82f6' }}>{parseResult.entities.length}</div>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>Entidades Total</div>
            </div>
            <div style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, color: '#10b981' }}>{parseResult.points.length}</div>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>Pontos/Nós</div>
            </div>
            <div style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, color: '#f59e0b' }}>{parseResult.edges.length}</div>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>Trechos/Linhas</div>
            </div>
            <div style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, color: '#8b5cf6' }}>{parseResult.allFields.length}</div>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>Campos Detectados</div>
            </div>
          </div>

          {/* TODOS os Campos do Arquivo */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              📋 Campos do Arquivo 
              <span style={{ fontSize: 12, color: '#10b981', fontWeight: 'normal' }}>
                (TODOS os {parseResult.allFields.length} campos detectados)
              </span>
            </h3>
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 8, 
              padding: 16, 
              backgroundColor: '#1e293b', 
              borderRadius: 8,
              maxHeight: 120,
              overflow: 'auto'
            }}>
              {parseResult.allFields.map(field => (
                <span key={field} style={{
                  padding: '6px 12px',
                  backgroundColor: '#334155',
                  borderRadius: 16,
                  fontSize: 13,
                  color: '#e2e8f0'
                }}>
                  {field}
                </span>
              ))}
            </div>
          </div>

          {/* Seleção de Trechos */}
          {parseResult.edges.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  📐 Trechos/Polilinhas ({parseResult.edges.length})
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={selectAll} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #3b82f6', backgroundColor: 'transparent', color: '#3b82f6', cursor: 'pointer', fontSize: 12 }}>
                    Selecionar Todos
                  </button>
                  <button onClick={selectNone} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #64748b', backgroundColor: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>
                    Limpar Seleção
                  </button>
                </div>
              </div>
              <div style={{ 
                maxHeight: 200, 
                overflow: 'auto', 
                backgroundColor: '#1e293b', 
                borderRadius: 8,
                border: '1px solid #334155'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#334155' }}>
                    <tr>
                      <th style={{ padding: 10, textAlign: 'left', width: 40 }}>✓</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>ID</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>Tipo</th>
                      <th style={{ padding: 10, textAlign: 'center' }}>Vértices</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>Layer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.edges.map(edge => (
                      <tr key={edge.id} style={{ borderBottom: '1px solid #334155', cursor: 'pointer' }} onClick={() => toggleEntity(edge.id)}>
                        <td style={{ padding: 10 }}>
                          <input type="checkbox" checked={selectedEntities.has(edge.id)} onChange={() => {}} style={{ cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: 10 }}>{edge.id}</td>
                        <td style={{ padding: 10 }}>{edge.attributes.type || 'LINE'}</td>
                        <td style={{ padding: 10, textAlign: 'center' }}>{edge.coordinates.length}</td>
                        <td style={{ padding: 10 }}>{edge.attributes.layer || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Seleção de Pontos */}
          {parseResult.points.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                📍 Pontos/Nós ({parseResult.points.length})
              </h3>
              <div style={{ 
                maxHeight: 200, 
                overflow: 'auto', 
                backgroundColor: '#1e293b', 
                borderRadius: 8,
                border: '1px solid #334155'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#334155' }}>
                    <tr>
                      <th style={{ padding: 10, textAlign: 'left', width: 40 }}>✓</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>ID</th>
                      <th style={{ padding: 10, textAlign: 'right' }}>X</th>
                      <th style={{ padding: 10, textAlign: 'right' }}>Y</th>
                      <th style={{ padding: 10, textAlign: 'right' }}>Z</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.points.slice(0, 100).map(point => (
                      <tr key={point.id} style={{ borderBottom: '1px solid #334155', cursor: 'pointer' }} onClick={() => toggleEntity(point.id)}>
                        <td style={{ padding: 10 }}>
                          <input type="checkbox" checked={selectedEntities.has(point.id)} onChange={() => {}} style={{ cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: 10 }}>{point.id}</td>
                        <td style={{ padding: 10, textAlign: 'right', fontFamily: 'monospace' }}>{point.x.toFixed(2)}</td>
                        <td style={{ padding: 10, textAlign: 'right', fontFamily: 'monospace' }}>{point.y.toFixed(2)}</td>
                        <td style={{ padding: 10, textAlign: 'right', fontFamily: 'monospace' }}>{point.z.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parseResult.points.length > 100 && (
                  <div style={{ padding: 10, textAlign: 'center', color: '#94a3b8' }}>
                    ... e mais {parseResult.points.length - 100} pontos
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Resumo da Seleção */}
          <div style={{ 
            padding: 16, 
            backgroundColor: '#10b98122', 
            border: '1px solid #10b981', 
            borderRadius: 8,
            marginBottom: 20
          }}>
            <h4 style={{ margin: '0 0 8px', color: '#10b981' }}>✅ Pronto para Importar</h4>
            <p style={{ margin: 0, color: '#94a3b8' }}>
              {selectedEntities.size} entidades selecionadas 
              ({parseResult.points.filter(p => selectedEntities.has(p.id)).length} pontos, {' '}
              {parseResult.edges.filter(e => selectedEntities.has(e.id)).length} trechos)
            </p>
          </div>
        </div>
      )}

      {/* Botões */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <button onClick={onCancel} style={{ 
          padding: '12px 24px', 
          borderRadius: 8, 
          border: '1px solid #ef4444', 
          backgroundColor: 'transparent', 
          color: '#ef4444', 
          cursor: 'pointer',
          fontSize: 14
        }}>
          Cancelar
        </button>
        
        <div style={{ display: 'flex', gap: 12 }}>
          {parseResult && (
            <button onClick={() => { setParseResult(null); setFile(null); }} style={{
              padding: '12px 24px',
              borderRadius: 8,
              border: '1px solid #64748b',
              backgroundColor: 'transparent',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 14
            }}>
              ← Voltar
            </button>
          )}
          
          <button 
            onClick={handleImport} 
            disabled={!parseResult || selectedEntities.size === 0}
            style={{
              padding: '12px 32px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: parseResult && selectedEntities.size > 0 ? '#10b981' : '#334155',
              color: '#fff',
              cursor: parseResult && selectedEntities.size > 0 ? 'pointer' : 'not-allowed',
              fontSize: 14,
              fontWeight: 'bold'
            }}
          >
            ✅ Confirmar Importação
          </button>
        </div>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default ImportWizard;

