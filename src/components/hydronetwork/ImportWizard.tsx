/**
 * 🆕 NOVO - Import Wizard Atualizado
 * Sem bloqueio de análise - Importação direta
 */

import React, { useState, useCallback } from 'react';

interface ImportWizardProps {
  onComplete: (result: any) => void;
  onCancel: () => void;
  initialFile?: File;
}

interface WizardState {
  step: number;
  file: File | null;
  fileData: any;
  crs: string;
  modelType: string;
  importing: boolean;
  error: string | null;
}

export const ImportWizard: React.FC<ImportWizardProps> = ({ onComplete, onCancel, initialFile }) => {
  const [state, setState] = useState<WizardState>({
    step: 1,
    file: initialFile || null,
    fileData: null,
    crs: 'EPSG:31983',
    modelType: 'topography',
    importing: false,
    error: null
  });

  const parseFile = async (file: File) => {
    const text = await file.text();
    const ext = file.name.split('.').pop()?.toLowerCase();
    const entities: any[] = [];
    
    if (ext === 'csv' || ext === 'txt') {
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length > 1) {
        const headers = lines[0].split(/[,;\t]/).map(h => h.trim());
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(/[,;\t]/).map(v => v.trim());
          const attrs: Record<string, string> = {};
          headers.forEach((h, j) => { attrs[h] = values[j] || ''; });
          entities.push({ id: `row_${i}`, type: 'POINT', attributes: attrs });
        }
      }
    } else if (ext === 'geojson' || ext === 'json') {
      try {
        const json = JSON.parse(text);
        (json.features || []).forEach((f: any, i: number) => {
          entities.push({ id: f.id || `f_${i}`, type: f.geometry?.type || 'Unknown', attributes: f.properties || {} });
        });
      } catch (e) { console.error(e); }
    } else if (ext === 'dxf') {
      const matches = text.match(/\n\s*0\n(LINE|LWPOLYLINE|POLYLINE|POINT|CIRCLE|ARC|TEXT|INSERT)/gi) || [];
      matches.forEach((m, i) => {
        entities.push({ id: `dxf_${i}`, type: m.replace(/[\n\s0]/g, '').toUpperCase(), attributes: {} });
      });
    }
    
    return { fileName: file.name, fileType: ext?.toUpperCase(), entities, totalEntities: entities.length };
  };

  const handleFileSelect = useCallback(async (files: FileList | File[]) => {
    const file = files[0];
    if (!file) return;
    setState(prev => ({ ...prev, file, importing: true, error: null }));
    try {
      const fileData = await parseFile(file);
      setState(prev => ({ ...prev, fileData, importing: false }));
    } catch (err: any) {
      setState(prev => ({ ...prev, importing: false, error: err.message }));
    }
  }, []);

  const handleImport = useCallback(() => {
    if (!state.fileData) return;
    setState(prev => ({ ...prev, importing: true }));
    setTimeout(() => {
      onComplete({
        success: true,
        fileName: state.file?.name,
        totalEntities: state.fileData.totalEntities,
        entities: state.fileData.entities
      });
    }, 500);
  }, [state.fileData, state.file, onComplete]);

  const nextStep = () => setState(prev => ({ ...prev, step: Math.min(prev.step + 1, 4) }));
  const prevStep = () => setState(prev => ({ ...prev, step: Math.max(prev.step - 1, 1) }));

  return (
    <div style={{ padding: 20, backgroundColor: '#1a1a2e', borderRadius: 12, color: '#eee', minWidth: 600 }}>
      {/* Header com badge NOVO */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Importação</h2>
        <span style={{ backgroundColor: '#10b981', color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 'bold' }}>
          🆕 NOVO
        </span>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['Arquivo & Modo', 'Sistema de Referência', 'Tipo de Modelo', 'Resumo'].map((label, i) => (
          <div key={i} style={{
            flex: 1, padding: 10, textAlign: 'center', borderRadius: 8,
            backgroundColor: state.step > i + 1 ? '#10b981' : state.step === i + 1 ? '#3b82f6' : '#374151',
            color: '#fff', fontSize: 13
          }}>
            {state.step > i + 1 ? '✓ ' : ''}{label}
          </div>
        ))}
      </div>

      {/* Error */}
      {state.error && (
        <div style={{ padding: 12, backgroundColor: '#dc262622', border: '1px solid #dc2626', borderRadius: 8, marginBottom: 16 }}>
          ⚠️ {state.error}
        </div>
      )}

      {/* Step 1 */}
      {state.step === 1 && (
        <div>
          <h3>Etapa 1: Selecione o Arquivo</h3>
          <div
            style={{
              border: '2px dashed #3b82f6', borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer',
              backgroundColor: state.file ? '#10b98122' : '#3b82f622'
            }}
            onDrop={e => { e.preventDefault(); handleFileSelect(e.dataTransfer.files); }}
            onDragOver={e => e.preventDefault()}
            onClick={() => document.getElementById('file-input-wizard')?.click()}
          >
            {state.importing ? <p>⏳ Analisando...</p> : state.file ? (
              <div>
                <p style={{ fontSize: 18 }}>✅ {state.file.name}</p>
                <p style={{ color: '#9ca3af' }}>{(state.file.size / 1024).toFixed(1)} KB</p>
                {state.fileData && <p style={{ color: '#10b981' }}>{state.fileData.totalEntities} entidades detectadas</p>}
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 24 }}>📁</p>
                <p>Arraste ou clique para selecionar</p>
                <p style={{ color: '#9ca3af', fontSize: 13 }}>DXF, GeoJSON, CSV, TXT, SHP</p>
              </div>
            )}
            <input id="file-input-wizard" type="file" style={{ display: 'none' }} accept=".dxf,.geojson,.json,.csv,.txt,.shp" onChange={e => e.target.files && handleFileSelect(e.target.files)} />
          </div>
        </div>
      )}

      {/* Step 2 */}
      {state.step === 2 && (
        <div>
          <h3>Etapa 2: Sistema de Referência</h3>
          <label>CRS de Destino:</label>
          <select value={state.crs} onChange={e => setState(prev => ({ ...prev, crs: e.target.value }))}
            style={{ width: '100%', padding: 10, marginTop: 8, borderRadius: 6, backgroundColor: '#111', color: '#eee', border: '1px solid #444' }}>
            <option value="EPSG:31983">EPSG:31983 - SIRGAS 2000 / UTM 23S</option>
            <option value="EPSG:31982">EPSG:31982 - SIRGAS 2000 / UTM 22S</option>
            <option value="EPSG:4326">EPSG:4326 - WGS 84</option>
          </select>
        </div>
      )}

      {/* Step 3 */}
      {state.step === 3 && (
        <div>
          <h3>Etapa 3: Tipo de Modelo</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { v: 'water_network', l: 'Água', i: '💧' },
              { v: 'sewer_network', l: 'Esgoto', i: '🚰' },
              { v: 'drainage_network', l: 'Drenagem', i: '🌧️' },
              { v: 'topography', l: 'Topografia', i: '🗺️' },
              { v: 'bim', l: 'BIM', i: '🏗️' },
              { v: 'gis_generic', l: 'GIS', i: '📍' }
            ].map(t => (
              <button key={t.v} onClick={() => setState(prev => ({ ...prev, modelType: t.v }))}
                style={{
                  padding: 16, borderRadius: 8, border: state.modelType === t.v ? '2px solid #3b82f6' : '1px solid #444',
                  backgroundColor: state.modelType === t.v ? '#3b82f633' : '#111', cursor: 'pointer', color: '#eee'
                }}>
                <div style={{ fontSize: 24 }}>{t.i}</div>
                <div>{t.l}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 4 - Resumo */}
      {state.step === 4 && (
        <div>
          <h3>Etapa 4: Resumo</h3>
          <div style={{ backgroundColor: '#10b98122', border: '1px solid #10b981', borderRadius: 8, padding: 20 }}>
            <h4 style={{ color: '#10b981', margin: '0 0 12px' }}>✅ Pronto para Importar</h4>
            <p><strong>Arquivo:</strong> {state.file?.name}</p>
            <p><strong>Entidades:</strong> {state.fileData?.totalEntities || 0}</p>
            <p><strong>CRS:</strong> {state.crs}</p>
            <p><strong>Modelo:</strong> {state.modelType}</p>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button onClick={onCancel} style={{ padding: '10px 20px', borderRadius: 6, border: '1px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
          Cancelar
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          {state.step > 1 && (
            <button onClick={prevStep} style={{ padding: '10px 20px', borderRadius: 6, border: '1px solid #3b82f6', backgroundColor: 'transparent', color: '#3b82f6', cursor: 'pointer' }}>
              ← Voltar
            </button>
          )}
          {state.step < 4 ? (
            <button onClick={nextStep} disabled={state.step === 1 && !state.fileData}
              style={{
                padding: '10px 20px', borderRadius: 6, border: 'none', cursor: state.step === 1 && !state.fileData ? 'not-allowed' : 'pointer',
                backgroundColor: state.step === 1 && !state.fileData ? '#444' : '#3b82f6', color: '#fff'
              }}>
              Próximo →
            </button>
          ) : (
            <button onClick={handleImport} disabled={state.importing}
              style={{ padding: '10px 24px', borderRadius: 6, border: 'none', backgroundColor: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>
              {state.importing ? '⏳ Importando...' : '✅ Confirmar Importação'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportWizard;

