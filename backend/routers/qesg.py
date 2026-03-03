"""QEsg API Router — Sewer network dimensioning endpoints.

Faithful to jorgealmerio/QEsg methodology:
- Analytical diameter: D = [n·Q / (√I·(A/D²)·(Rh/D)^(2/3))]^(3/8) × 1000
- θ binary search with M threshold 0.335282
- τ = 10000·Rh·I (Pa)
- v_crit = 6·√(g·Rh)
- I_min = 0.0055·Q^(-0.47)
"""

from fastapi import APIRouter
from models.schemas import SewerDimensionRequest, SewerDimensionResponse, SewerSegmentResult
from engines.qesg_engine import dimension_sewer_network

router = APIRouter(prefix="/api/qesg", tags=["QEsg - Esgoto"])


@router.post("/dimension", response_model=SewerDimensionResponse)
async def dimension_sewer(request: SewerDimensionRequest):
    """
    Dimensionar rede coletora de esgoto sanitário.

    Algoritmo portado do QEsg (jorgealmerio/QEsg) com fórmulas de Manning
    e critérios da NBR 9649:
    - Lâmina d'água máxima (y/D ≤ 0.75)
    - Velocidade mínima (0.6 m/s) e máxima (5.0 m/s)
    - Tensão trativa mínima (1.0 Pa)
    - Velocidade crítica: se V > v_c, y/D deve ser ≤ 0.50
    - Declividade mínima: I_min = 0.0055·Q^(-0.47)
    """
    trechos = [
        {
            "id": t.id,
            "vazao_lps": t.vazao_lps,
            "comprimento": t.comprimento,
            "cota_montante": t.cota_montante,
            "cota_jusante": t.cota_jusante,
            "tipo_tubo": t.tipo_tubo,
        }
        for t in request.trechos
    ]

    results = dimension_sewer_network(
        trechos=trechos,
        n=request.coeficiente_manning,
        lamina_max=request.lamina_maxima,
        vel_min=request.velocidade_minima,
        vel_max=request.velocidade_maxima,
        tensao_min=request.tensao_trativa_minima,
        diam_min_mm=request.diametro_minimo_mm,
    )

    resultados = [
        SewerSegmentResult(
            id=r["id"],
            diametro_mm=r["diametro_mm"],
            diametro_calculado_mm=r.get("diametro_calculado_mm"),
            declividade_min=r["declividade_min"],
            declividade_usada=r.get("declividade_usada"),
            velocidade_ms=r["velocidade_ms"],
            velocidade_critica_ms=r.get("velocidade_critica_ms"),
            lamina_dagua=r["lamina_dagua"],
            tensao_trativa=r["tensao_trativa"],
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
        "norma_referencia": "NBR 9649",
        "formulas": "Manning (QEsg port)",
    }

    return SewerDimensionResponse(resultados=resultados, resumo=resumo)


@router.post("/verify", response_model=SewerDimensionResponse)
async def verify_sewer(request: SewerDimensionRequest):
    """
    Verificar rede de esgoto existente contra critérios normativos.
    Mesmo algoritmo que /dimension.
    """
    return await dimension_sewer(request)
