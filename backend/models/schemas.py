"""Pydantic models for QEsg and QWater API requests/responses."""

from pydantic import BaseModel, Field
from typing import Optional, List


# ═══ QEsg (Sewer) Models ═══

class SewerSegmentInput(BaseModel):
    """Input for a single sewer pipe segment."""
    id: str = Field(..., description="Segment identifier")
    comprimento: float = Field(..., gt=0, description="Length in meters")
    cota_montante: float = Field(..., description="Upstream elevation (m)")
    cota_jusante: float = Field(..., description="Downstream elevation (m)")
    vazao_lps: float = Field(..., ge=0, description="Flow rate in L/s")
    populacao: Optional[float] = Field(None, ge=0, description="Contributing population")
    tipo_tubo: str = Field("PVC", description="Pipe material (PVC, Concreto, PEAD)")


class SewerSegmentResult(BaseModel):
    """Dimensioning result for a single sewer segment."""
    id: str
    diametro_mm: int = Field(..., description="Calculated diameter (mm)")
    declividade_min: float = Field(..., description="Minimum slope (m/m)")
    velocidade_ms: float = Field(..., description="Flow velocity (m/s)")
    lamina_dagua: float = Field(..., description="Water depth y/D ratio")
    tensao_trativa: float = Field(..., description="Tractive stress (Pa)")
    atende_norma: bool = Field(..., description="Meets NBR 9649 criteria")
    observacoes: List[str] = Field(default_factory=list)


class SewerDimensionRequest(BaseModel):
    """Request to dimension a sewer network."""
    trechos: List[SewerSegmentInput]
    coeficiente_manning: float = Field(0.013, description="Manning's n coefficient")
    lamina_maxima: float = Field(0.75, description="Max y/D ratio")
    velocidade_minima: float = Field(0.6, description="Min velocity (m/s)")
    velocidade_maxima: float = Field(5.0, description="Max velocity (m/s)")
    tensao_trativa_minima: float = Field(1.0, description="Min tractive stress (Pa)")
    diametro_minimo_mm: int = Field(100, description="Minimum diameter (mm)")


class SewerDimensionResponse(BaseModel):
    """Response from sewer dimensioning."""
    resultados: List[SewerSegmentResult]
    resumo: dict = Field(default_factory=dict)


# ═══ QWater (Water) Models ═══

class WaterSegmentInput(BaseModel):
    """Input for a single water distribution pipe segment."""
    id: str = Field(..., description="Segment identifier")
    comprimento: float = Field(..., gt=0, description="Length in meters")
    cota_montante: float = Field(..., description="Upstream node elevation (m)")
    cota_jusante: float = Field(..., description="Downstream node elevation (m)")
    vazao_lps: float = Field(..., ge=0, description="Flow rate in L/s")
    material: str = Field("PVC", description="Pipe material")
    pressao_montante: Optional[float] = Field(None, description="Upstream pressure (mca)")


class WaterSegmentResult(BaseModel):
    """Dimensioning result for a single water pipe segment."""
    id: str
    diametro_mm: int = Field(..., description="Calculated diameter (mm)")
    velocidade_ms: float = Field(..., description="Flow velocity (m/s)")
    perda_carga_m: float = Field(..., description="Head loss (m)")
    perda_carga_unitaria: float = Field(..., description="Unit head loss (m/m)")
    pressao_jusante: Optional[float] = Field(None, description="Downstream pressure (mca)")
    atende_norma: bool = Field(..., description="Meets NBR 12218 criteria")
    observacoes: List[str] = Field(default_factory=list)


class WaterDimensionRequest(BaseModel):
    """Request to dimension a water distribution network."""
    trechos: List[WaterSegmentInput]
    formula: str = Field("hazen-williams", description="Formula: hazen-williams or colebrook")
    coeficiente_hw: float = Field(140, description="Hazen-Williams C coefficient")
    velocidade_minima: float = Field(0.6, description="Min velocity (m/s)")
    velocidade_maxima: float = Field(3.5, description="Max velocity (m/s)")
    pressao_minima: float = Field(10.0, description="Min pressure (mca)")
    pressao_maxima: float = Field(50.0, description="Max pressure (mca)")
    diametro_minimo_mm: int = Field(50, description="Minimum diameter (mm)")


class WaterDimensionResponse(BaseModel):
    """Response from water network dimensioning."""
    resultados: List[WaterSegmentResult]
    resumo: dict = Field(default_factory=dict)
