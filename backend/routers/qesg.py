"""QEsg API Router — Sewer network dimensioning endpoints."""

from fastapi import APIRouter
from models.schemas import SewerDimensionRequest, SewerDimensionResponse, SewerSegmentResult
from engines.qesg_engine import dimension_sewer_network

router = APIRouter(prefix="/api/qesg", tags=["QEsg - Esgoto"])


@router.post("/dimension", response_model=SewerDimensionResponse)
async def dimension_sewer(request: SewerDimensionRequest):
    """
    Dimensionar rede coletora de esgoto sanitário.

    Aplica a fórmula de Manning com os critérios da NBR 9649:
    - Lâmina d'água máxima (y/D)
    - Velocidade mínima e máxima
    - Tensão trativa mínima
    - Diâmetro mínimo
    """
    trechos = [
        {
            "id": t.id,
            "vazao_lps": t.vazao_lps,
            "comprimento": t.comprimento,
            "cota_montante": t.cota_montante,
            "cota_jusante": t.cota_jusante,
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
            declividade_min=r["declividade_min"],
            velocidade_ms=r["velocidade_ms"],
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
    }

    return SewerDimensionResponse(resultados=resultados, resumo=resumo)


@router.post("/verify", response_model=SewerDimensionResponse)
async def verify_sewer(request: SewerDimensionRequest):
    """
    Verificar rede de esgoto existente contra critérios normativos.
    Mesmo endpoint que dimension, mas usado semanticamente para verificação.
    """
    return await dimension_sewer(request)
