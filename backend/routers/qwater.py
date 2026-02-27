"""QWater API Router — Water distribution network dimensioning endpoints."""

from fastapi import APIRouter
from models.schemas import WaterDimensionRequest, WaterDimensionResponse, WaterSegmentResult
from engines.qwater_engine import dimension_water_network

router = APIRouter(prefix="/api/qwater", tags=["QWater - Água"])


@router.post("/dimension", response_model=WaterDimensionResponse)
async def dimension_water(request: WaterDimensionRequest):
    """
    Dimensionar rede de distribuição de água.

    Aplica Hazen-Williams ou Colebrook-White com critérios da NBR 12218:
    - Velocidade mínima e máxima
    - Pressão mínima e máxima nos nós
    - Diâmetro mínimo
    """
    trechos = [
        {
            "id": t.id,
            "vazao_lps": t.vazao_lps,
            "comprimento": t.comprimento,
            "cota_montante": t.cota_montante,
            "cota_jusante": t.cota_jusante,
            "material": t.material,
            "pressao_montante": t.pressao_montante,
        }
        for t in request.trechos
    ]

    results = dimension_water_network(
        trechos=trechos,
        formula=request.formula,
        c_hw=request.coeficiente_hw,
        vel_min=request.velocidade_minima,
        vel_max=request.velocidade_maxima,
        pressao_min=request.pressao_minima,
        pressao_max=request.pressao_maxima,
        diam_min_mm=request.diametro_minimo_mm,
    )

    resultados = [
        WaterSegmentResult(
            id=r["id"],
            diametro_mm=r["diametro_mm"],
            velocidade_ms=r["velocidade_ms"],
            perda_carga_m=r["perda_carga_m"],
            perda_carga_unitaria=r["perda_carga_unitaria"],
            pressao_jusante=r.get("pressao_jusante"),
            atende_norma=r["atende_norma"],
            observacoes=r.get("observacoes", []),
        )
        for r in results
    ]

    atende_count = sum(1 for r in resultados if r.atende_norma)
    resumo = {
        "total_trechos": len(resultados),
        "atendem_norma": atende_count,
        "nao_atendem": len(resultados) - atende_count,
        "norma_referencia": "NBR 12218",
    }

    return WaterDimensionResponse(resultados=resultados, resumo=resumo)


@router.post("/verify", response_model=WaterDimensionResponse)
async def verify_water(request: WaterDimensionRequest):
    """
    Verificar rede de água existente contra critérios normativos.
    """
    return await dimension_water(request)
