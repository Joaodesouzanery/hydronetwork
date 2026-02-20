/**
 * Import Wizard - Wizard de Importação em 4 Etapas
 * 🆕 VERSÃO ATUALIZADA - Sem bloqueio de análise
 *
 * Etapa 1: Detecção de Arquivo
 * Etapa 2: Sistema de Referência (CRS)
 * Etapa 3: Tipo de Modelo
 * Etapa 4: Mapeamento de Atributos
 */

import React, { useState, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface RawImportData {
  fileType: 'IFC' | 'DWG' | 'DXF' | 'SHP' | 'GeoJSON' | 'CSV' | 'TXT' | 'INP';
  fileName: string;
  fileSize: number;
  rawContent: any;
  entities: RawEntity[];
  metadata: ImportMetadata;
}

export interface RawEntity {
  id: string;
  type: string;
  geometry: any;
  attributes: Record<string, any>;
  layer?: string;
}

export interface ImportMetadata {
  detectedCRS: string | null;
  detectedUnit: string | null;
  hasZ: boolean;
  geometryType: 'point' | 'line' | 'polygon' | 'mixed';
  entityTypes: EntityTypeInfo[];
  numericFormat: 'brazilian' | 'american' | 'unknown';
  totalEntities: number;
}

export interface EntityTypeInfo {
  type: string;
  count: number;
  suggestedImportAs: 'edge' | 'node' | 'drawing' | 'ignore';
  hasZ: boolean;
  sampleAttributes: string[];
}

export interface ImportWizardState {
  currentStep: 1 | 2 | 3 | 4;
  file: File | null;
  fileData: RawImportData | null;
  crsSelection: CRSSelection | null;
  modelTypeSelection: ModelTypeSelection | null;
  attributeMapping: Record<string, string>;
  importing: boolean;
  error: string | null;
}

export interface CRSSelection {
  sourceCRS: string | null;
  targetCRS: string;
  transformationRequired: boolean;
  numericFormat: {
    detected: 'brazilian' | 'american' | 'unknown';
    userSelection: 'brazilian' | 'american' | 'auto';
  };
}

export interface ModelTypeSelection {
  modelType: 'water_network' | 'sewer_network' | 'drainage_network' |
             'pumping_network' | 'topography' | 'bim' | 'gis_generic';
  importMode: 'geometric' | 'tabular';
}

// ============================================================================
// SIMPLE FILE PARSER
// ============================================================================

const parseFile = async (file: File): Promise<RawImportData> => {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const content = await file.text();
  
  const fileTypeMap: Record<string, RawImportData['fileType']> = {
    'dxf': 'DXF',
    'geojson': 'GeoJSON',
    'json': 'GeoJSON',
    'csv': 'CSV',
    'txt': 'TXT',
    'shp': 'SHP',
    'inp': 'INP'
  };
  
  const fileType = fileTypeMap[extension] || 'TXT';
  const entities: RawEntity[] = [];
  
  // Parse based on file type
  if (fileType === 'CSV' || fileType === 'TXT') {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length > 1) {
      const headers = lines[0].split(/[,;\t]/).map(h => h.trim());
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(/[,;\t]/).map(v => v.trim());
        const attributes: Record<string, any> = {};
        headers.forEach((h, j) => { attributes[h] = values[j]; });
        entities.push({
          id: `row_${i}`,
          type: 'CSV_ROW',
          geometry: null,
          attributes
        });
      }
    }
  } else if (fileType === 'GeoJSON') {
    try {
      const geojson = JSON.parse(content);
      if (geojson.features) {
        geojson.features.forEach((f: any, i: number) => {
          entities.push({
            id: f.id || `feature_${i}`,
            type: f.geometry?.type || 'Unknown',
            geometry: f.geometry,
            attributes: f.properties || {}
          });
        });
      }
    } catch (e) {
      console.error('Error parsing GeoJSON:', e);
    }
  } else if (fileType === 'DXF') {
    // Simple DXF parsing
    const entityMatches = content.match(/\n\s*0\n(LINE|LWPOLYLINE|POLYLINE|POINT|CIRCLE|ARC|TEXT)/gi) || [];
    entityMatches.forEach((match, i) => {
      const type = match.replace(/[\n\s0]/g, '').toUpperCase();
      entities.push({
        id: `dxf_${i}`,
        type,
        geometry: null,
        attributes: { layer: 'default' }
      });
    });
  }
  
  // Group entity types
  const entityTypeGroups = new Map<string, RawEntity[]>();
  entities.forEach(e => {
    if (!entityTypeGroups.has(e.type)) entityTypeGroups.set(e.type, []);
    entityTypeGroups.get(e.type)!.push(e);
  });
  
  const entityTypes: EntityTypeInfo[] = Array.from(entityTypeGroups.entries()).map(([type, items]) => ({
    type,
    count: items.length,
    suggestedImportAs: ['LINE', 'LWPOLYLINE', 'POLYLINE', 'LineString'].includes(type) ? 'edge' : 
                       ['POINT', 'Point'].includes(type) ? 'node' : 'drawing',
    hasZ: false,
    sampleAttributes: items.length > 0 ? Object.keys(items[0].attributes) : []
  }));
  
  return {
    fileType,
    fileName: file.name,
    fileSize: file.size,
    rawContent: content,
    entities,
    metadata: {
      detectedCRS: null,
      detectedUnit: null,
      hasZ: false,
      geometryType: 'mixed',
      entityTypes,
      numericFormat: 'unknown',
      totalEntities: entities.length
    }
  };
};

// ============================================================================
// IMPORT WIZARD COMPONENT
// ============================================================================

export const ImportWizard: React.FC<{
  onComplete: (result: any) => void;
  onCancel: () => void;
}> = ({ onComplete, onCancel }) => {
  const [state, setState] = useState<ImportWizardState>({
    currentStep: 1,
    file: null,
    fileData: null,
    crsSelection: null,
    modelTypeSelection: null,
    attributeMapping: {},
    importing: false,
    error: null
  });

  const goToStep = (step: ImportWizardState['currentStep']) => {
    setState(prev => ({ ...prev, currentStep: step, error: null }));
  };

  const nextStep = () => {
    if (state.currentStep < 4) {
      goToStep((state.currentStep + 1) as ImportWizardState['currentStep']);
    }
  };

  const prevStep = () => {
    if (state.currentStep > 1) {
      goToStep((state.currentStep - 1) as ImportWizardState['currentStep']);
    }
  };

  const handleFileSelect = useCallback(async (files: File[]) => {
    const mainFile = files[0];
    if (!mainFile) return;

    setState(prev => ({ ...prev, file: mainFile, importing: true, error: null }));

    try {
      const fileData = await parseFile(mainFile);
      setState(prev => ({
        ...prev,
        fileData,
        importing: false,
        crsSelection: {
          sourceCRS: fileData.metadata.detectedCRS,
          targetCRS: 'EPSG:31983',
          transformationRequired: true,
          numericFormat: {
            detected: fileData.metadata.numericFormat,
            userSelection: 'auto'
          }
        }
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        importing: false,
        error: `Erro ao ler arquivo: ${error.message}`
      }));
    }
  }, []);

  const executeImport = useCallback(async () => {
    if (!state.fileData) {
      setState(prev => ({ ...prev, error: 'Nenhum arquivo carregado' }));
      return;
    }

    setState(prev => ({ ...prev, importing: true, error: null }));

    try {
      // Criar resultado da importação
      const result = {
        success: true,
        model: {
          nodes: state.fileData.entities.filter(e => 
            state.fileData?.metadata.entityTypes.find(et => et.type === e.type)?.suggestedImportAs === 'node'
          ),
          edges: state.fileData.entities.filter(e => 
            state.fileData?.metadata.entityTypes.find(et => et.type === e.type)?.suggestedImportAs === 'edge'
          ),
          drawingLayers: []
        },
        statistics: {
          totalEntities: state.fileData.entities.length,
          importedNodes: 0,
          importedEdges: 0,
          importedDrawings: 0,
          ignoredEntities: 0,
          generatedNodes: 0,
          processingTime: 0
        },
        warnings: [],
        errors: []
      };

      setState(prev => ({ ...prev, importing: false }));
      onComplete(result);
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        importing: false,
        error: `Erro na importação: ${error.message}`
      }));
    }
  }, [state.fileData, onComplete]);

  return (
    <div className="import-wizard" style={{ padding: '20px', backgroundColor: '#1e293b', borderRadius: '12px', color: '#e2e8f0' }}>
      {/* Header com badge NOVO */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Importar Arquivo</h2>
        <span style={{
          backgroundColor: '#22c55e',
          color: 'white',
          padding: '4px 10px',
          borderRadius: '12px',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          animation: 'pulse 2s infinite'
        }}>
          🆕 NOVO
        </span>
      </div>

      {/* Progress Bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {[1, 2, 3, 4].map(step => (
          <div
            key={step}
            style={{
              flex: 1,
              padding: '10px',
              textAlign: 'center',
              backgroundColor: state.currentStep >= step ? '#3b82f6' : '#334155',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            onClick={() => step <= state.currentStep && goToStep(step as any)}
          >
            <div style={{ fontWeight: 'bold' }}>{step}</div>
            <div style={{ fontSize: '0.8rem' }}>
              {step === 1 && 'Arquivo'}
              {step === 2 && 'CRS'}
              {step === 3 && 'Modelo'}
              {step === 4 && 'Atributos'}
            </div>
          </div>
        ))}
      </div>

      {/* Error Display */}
      {state.error && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: 'rgba(239, 68, 68, 0.2)', 
          border: '1px solid #ef4444',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          ⚠️ {state.error}
        </div>
      )}

      {/* Step Content */}
      <div style={{ minHeight: '300px', marginBottom: '20px' }}>
        {state.currentStep === 1 && (
          <div>
            <h3>Etapa 1: Selecione o Arquivo</h3>
            <div
              style={{
                border: '2px dashed #3b82f6',
                borderRadius: '12px',
                padding: '40px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: state.file ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)'
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleFileSelect(Array.from(e.dataTransfer.files));
              }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              {state.importing ? (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⏳</div>
                  <p>Analisando arquivo...</p>
                </div>
              ) : state.file ? (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: '10px' }}>✅</div>
                  <p><strong>{state.file.name}</strong></p>
                  <p style={{ color: '#94a3b8' }}>{(state.file.size / 1024).toFixed(1)} KB</p>
                  {state.fileData && (
                    <p style={{ color: '#22c55e' }}>
                      {state.fileData.metadata.totalEntities} entidades detectadas
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📁</div>
                  <p>Arraste arquivos aqui ou clique para selecionar</p>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                    DXF, GeoJSON, CSV, TXT, SHP, INP
                  </p>
                </div>
              )}
              <input
                id="file-input"
                type="file"
                style={{ display: 'none' }}
                accept=".dxf,.geojson,.json,.csv,.txt,.shp,.inp"
                onChange={(e) => handleFileSelect(Array.from(e.target.files || []))}
              />
            </div>

            {state.fileData && state.fileData.metadata.entityTypes.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h4>Tipos de Entidade Detectados:</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#334155' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Tipo</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Quantidade</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Importar como</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.fileData.metadata.entityTypes.map(et => (
                      <tr key={et.type} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '10px' }}>{et.type}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>{et.count}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <select
                            value={et.suggestedImportAs}
                            onChange={(e) => {
                              const newTypes = state.fileData!.metadata.entityTypes.map(t =>
                                t.type === et.type ? { ...t, suggestedImportAs: e.target.value as any } : t
                              );
                              setState(prev => ({
                                ...prev,
                                fileData: {
                                  ...prev.fileData!,
                                  metadata: { ...prev.fileData!.metadata, entityTypes: newTypes }
                                }
                              }));
                            }}
                            style={{ padding: '5px', borderRadius: '4px', backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' }}
                          >
                            <option value="edge">Trecho</option>
                            <option value="node">Nó</option>
                            <option value="drawing">Desenho</option>
                            <option value="ignore">Ignorar</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {state.currentStep === 2 && (
          <div>
            <h3>Etapa 2: Sistema de Referência (CRS)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>CRS de Origem:</label>
                <select
                  value={state.crsSelection?.sourceCRS || ''}
                  onChange={(e) => setState(prev => ({
                    ...prev,
                    crsSelection: { ...prev.crsSelection!, sourceCRS: e.target.value }
                  }))}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' }}
                >
                  <option value="">-- Detectar automaticamente --</option>
                  <option value="EPSG:31981">EPSG:31981 - SIRGAS 2000 / UTM 21S</option>
                  <option value="EPSG:31982">EPSG:31982 - SIRGAS 2000 / UTM 22S</option>
                  <option value="EPSG:31983">EPSG:31983 - SIRGAS 2000 / UTM 23S</option>
                  <option value="EPSG:31984">EPSG:31984 - SIRGAS 2000 / UTM 24S</option>
                  <option value="EPSG:4326">EPSG:4326 - WGS 84</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>CRS de Destino:</label>
                <select
                  value={state.crsSelection?.targetCRS || 'EPSG:31983'}
                  onChange={(e) => setState(prev => ({
                    ...prev,
                    crsSelection: { ...prev.crsSelection!, targetCRS: e.target.value }
                  }))}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' }}
                >
                  <option value="EPSG:31981">EPSG:31981 - SIRGAS 2000 / UTM 21S</option>
                  <option value="EPSG:31982">EPSG:31982 - SIRGAS 2000 / UTM 22S</option>
                  <option value="EPSG:31983">EPSG:31983 - SIRGAS 2000 / UTM 23S</option>
                  <option value="EPSG:31984">EPSG:31984 - SIRGAS 2000 / UTM 24S</option>
                  <option value="EPSG:4326">EPSG:4326 - WGS 84</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {state.currentStep === 3 && (
          <div>
            <h3>Etapa 3: Tipo de Modelo</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { value: 'water_network', label: 'Rede de Água', icon: '💧' },
                { value: 'sewer_network', label: 'Rede de Esgoto', icon: '🚰' },
                { value: 'drainage_network', label: 'Drenagem', icon: '🌧️' },
                { value: 'topography', label: 'Topografia', icon: '🗺️' },
                { value: 'bim', label: 'Modelo BIM', icon: '🏗️' },
                { value: 'gis_generic', label: 'GIS Genérico', icon: '📍' }
              ].map(type => (
                <button
                  key={type.value}
                  onClick={() => setState(prev => ({
                    ...prev,
                    modelTypeSelection: { 
                      modelType: type.value as any, 
                      importMode: prev.modelTypeSelection?.importMode || 'geometric' 
                    }
                  }))}
                  style={{
                    padding: '20px',
                    borderRadius: '8px',
                    border: state.modelTypeSelection?.modelType === type.value ? '2px solid #3b82f6' : '1px solid #334155',
                    backgroundColor: state.modelTypeSelection?.modelType === type.value ? 'rgba(59, 130, 246, 0.2)' : '#0f172a',
                    cursor: 'pointer',
                    textAlign: 'center',
                    color: '#e2e8f0'
                  }}
                >
                  <div style={{ fontSize: '2rem' }}>{type.icon}</div>
                  <div>{type.label}</div>
                </button>
              ))}
            </div>

            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px' }}>Modo de Importação:</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setState(prev => ({
                    ...prev,
                    modelTypeSelection: { ...prev.modelTypeSelection!, importMode: 'geometric' }
                  }))}
                  style={{
                    flex: 1,
                    padding: '15px',
                    borderRadius: '8px',
                    border: state.modelTypeSelection?.importMode === 'geometric' ? '2px solid #3b82f6' : '1px solid #334155',
                    backgroundColor: state.modelTypeSelection?.importMode === 'geometric' ? 'rgba(59, 130, 246, 0.2)' : '#0f172a',
                    cursor: 'pointer',
                    color: '#e2e8f0'
                  }}
                >
                  <strong>🔷 Geométrico</strong>
                  <p style={{ margin: '5px 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                    Linhas → Trechos, Pontos → Nós
                  </p>
                </button>
                <button
                  onClick={() => setState(prev => ({
                    ...prev,
                    modelTypeSelection: { ...prev.modelTypeSelection!, importMode: 'tabular' }
                  }))}
                  style={{
                    flex: 1,
                    padding: '15px',
                    borderRadius: '8px',
                    border: state.modelTypeSelection?.importMode === 'tabular' ? '2px solid #3b82f6' : '1px solid #334155',
                    backgroundColor: state.modelTypeSelection?.importMode === 'tabular' ? 'rgba(59, 130, 246, 0.2)' : '#0f172a',
                    cursor: 'pointer',
                    color: '#e2e8f0'
                  }}
                >
                  <strong>📋 Tabular</strong>
                  <p style={{ margin: '5px 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                    Usa campos Nó Início/Nó Fim
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}

        {state.currentStep === 4 && (
          <div>
            <h3>Etapa 4: Mapeamento de Atributos</h3>
            {state.fileData && state.fileData.entities.length > 0 ? (
              <div>
                <p style={{ color: '#94a3b8', marginBottom: '15px' }}>
                  Campos detectados no arquivo:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                  {Object.keys(state.fileData.entities[0]?.attributes || {}).map(attr => (
                    <span key={attr} style={{
                      padding: '5px 12px',
                      backgroundColor: '#334155',
                      borderRadius: '15px',
                      fontSize: '0.85rem'
                    }}>
                      {attr}
                    </span>
                  ))}
                </div>

                <div style={{
                  padding: '20px',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid #22c55e',
                  borderRadius: '8px'
                }}>
                  <h4 style={{ margin: '0 0 10px', color: '#22c55e' }}>✅ Pronto para Importar</h4>
                  <p style={{ margin: 0, color: '#94a3b8' }}>
                    {state.fileData.metadata.totalEntities} entidades serão importadas.
                  </p>
                </div>
              </div>
            ) : (
              <p style={{ color: '#94a3b8' }}>Nenhum dado para mapear.</p>
            )}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '10px 20px',
            borderRadius: '6px',
            border: '1px solid #ef4444',
            backgroundColor: 'transparent',
            color: '#ef4444',
            cursor: 'pointer'
          }}
        >
          Cancelar
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          {state.currentStep > 1 && (
            <button
              onClick={prevStep}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                border: '1px solid #3b82f6',
                backgroundColor: 'transparent',
                color: '#3b82f6',
                cursor: 'pointer'
              }}
            >
              ← Anterior
            </button>
          )}

          {state.currentStep < 4 ? (
            <button
              onClick={nextStep}
              disabled={
                (state.currentStep === 1 && !state.fileData) ||
                (state.currentStep === 3 && !state.modelTypeSelection)
              }
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: (state.currentStep === 1 && !state.fileData) || (state.currentStep === 3 && !state.modelTypeSelection) ? '#334155' : '#3b82f6',
                color: 'white',
                cursor: (state.currentStep === 1 && !state.fileData) || (state.currentStep === 3 && !state.modelTypeSelection) ? 'not-allowed' : 'pointer'
              }}
            >
              Próximo →
            </button>
          ) : (
            <button
              onClick={executeImport}
              disabled={state.importing}
              style={{
                padding: '10px 30px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#22c55e',
                color: 'white',
                cursor: state.importing ? 'wait' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              {state.importing ? '⏳ Importando...' : '✅ Importar'}
            </button>
          )}
        </div>
      </div>

      {/* Pulse animation for NOVO badge */}
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
