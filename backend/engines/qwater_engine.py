"""
QWater Engine — Water distribution network dimensioning algorithms.

Based on Brazilian standards NBR 12218.
Implements Hazen-Williams and Colebrook-White equations.

References:
- Sketua/QWater QGIS plugin
- NBR 12218: Projeto de rede de distribuição de água
"""

import math
from typing import List, Optional

# Standard commercial diameters for water pipes (mm)
DIAMETROS_COMERCIAIS = [50, 75, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800]

# Hazen-Williams C coefficients by material
HW_COEFFICIENTS = {
    "PVC": 140,
    "PEAD": 140,
    "PE": 140,
    "Ferro Fundido Novo": 130,
    "Ferro Fundido": 100,
    "FF": 100,
    "Aço": 120,
    "Concreto": 110,
    "Fibrocimento": 125,
}


def hazen_williams_headloss(
    flow_m3s: float,
    length_m: float,
    diameter_m: float,
    c: float = 140,
) -> float:
    """
    Hazen-Williams head loss formula:
    hf = 10.643 * Q^1.85 / (C^1.85 * D^4.87) * L

    Returns head loss in meters.
    """
    if diameter_m <= 0 or flow_m3s <= 0:
        return 0.0

    j = 10.643 * (flow_m3s ** 1.85) / ((c ** 1.85) * (diameter_m ** 4.87))
    return j * length_m


def hazen_williams_velocity(flow_m3s: float, diameter_m: float) -> float:
    """Calculate flow velocity V = Q / A."""
    if diameter_m <= 0:
        return 0.0
    area = math.pi * (diameter_m / 2) ** 2
    return flow_m3s / area if area > 0 else 0.0


def colebrook_white_friction(
    velocity: float,
    diameter_m: float,
    roughness_mm: float = 0.1,
    viscosity: float = 1.01e-6,
) -> float:
    """
    Colebrook-White friction factor (iterative solution).
    1/sqrt(f) = -2*log10(ε/(3.7*D) + 2.51/(Re*sqrt(f)))
    """
    if velocity <= 0 or diameter_m <= 0:
        return 0.0

    re = velocity * diameter_m / viscosity
    if re < 2000:
        return 64 / re if re > 0 else 0.0

    eps = roughness_mm / 1000.0
    rel_rough = eps / diameter_m

    # Initial estimate (Swamee-Jain)
    f = 0.25 / (math.log10(rel_rough / 3.7 + 5.74 / (re ** 0.9))) ** 2

    # Iterate
    for _ in range(20):
        rhs = -2.0 * math.log10(rel_rough / 3.7 + 2.51 / (re * math.sqrt(f)))
        f_new = 1.0 / (rhs ** 2) if rhs != 0 else f
        if abs(f_new - f) < 1e-8:
            break
        f = f_new

    return f


def darcy_weisbach_headloss(
    flow_m3s: float,
    length_m: float,
    diameter_m: float,
    roughness_mm: float = 0.1,
) -> float:
    """
    Darcy-Weisbach head loss: hf = f * (L/D) * (V²/2g)
    Uses Colebrook-White for friction factor.
    """
    if diameter_m <= 0 or flow_m3s <= 0:
        return 0.0

    velocity = hazen_williams_velocity(flow_m3s, diameter_m)
    f = colebrook_white_friction(velocity, diameter_m, roughness_mm)

    g = 9.81
    return f * (length_m / diameter_m) * (velocity ** 2) / (2 * g)


def dimension_water_segment(
    vazao_lps: float,
    comprimento: float,
    cota_montante: float,
    cota_jusante: float,
    material: str = "PVC",
    pressao_montante: Optional[float] = None,
    formula: str = "hazen-williams",
    c_hw: float = 140,
    vel_min: float = 0.6,
    vel_max: float = 3.5,
    pressao_min: float = 10.0,
    pressao_max: float = 50.0,
    diam_min_mm: int = 50,
) -> dict:
    """
    Dimension a single water distribution segment.

    Returns dict with: diametro_mm, velocidade, perda_carga, pressao_jusante, atende_norma
    """
    vazao_m3s = vazao_lps / 1000.0

    # Get C coefficient from material if not specified
    if material in HW_COEFFICIENTS:
        c_hw = HW_COEFFICIENTS[material]

    observacoes = []
    best_result = None

    for diam_mm in DIAMETROS_COMERCIAIS:
        if diam_mm < diam_min_mm:
            continue

        diam_m = diam_mm / 1000.0

        # Calculate velocity
        vel = hazen_williams_velocity(vazao_m3s, diam_m)

        # Calculate head loss
        if formula == "colebrook":
            hf = darcy_weisbach_headloss(vazao_m3s, comprimento, diam_m)
        else:
            hf = hazen_williams_headloss(vazao_m3s, comprimento, diam_m, c_hw)

        j = hf / comprimento if comprimento > 0 else 0

        # Calculate downstream pressure if upstream is known
        pressao_jus = None
        if pressao_montante is not None:
            pressao_jus = pressao_montante + (cota_montante - cota_jusante) - hf

        # Check criteria
        atende = True
        obs = []

        if vel < vel_min:
            atende = False
            obs.append(f"Velocidade abaixo do mínimo ({vel:.2f} < {vel_min} m/s)")
        if vel > vel_max:
            atende = False
            obs.append(f"Velocidade acima do máximo ({vel:.2f} > {vel_max} m/s)")
        if pressao_jus is not None:
            if pressao_jus < pressao_min:
                atende = False
                obs.append(f"Pressão abaixo do mínimo ({pressao_jus:.1f} < {pressao_min} mca)")
            if pressao_jus > pressao_max:
                obs.append(f"Pressão acima do máximo ({pressao_jus:.1f} > {pressao_max} mca)")

        result = {
            "diametro_mm": diam_mm,
            "velocidade_ms": round(vel, 3),
            "perda_carga_m": round(hf, 4),
            "perda_carga_unitaria": round(j, 6),
            "pressao_jusante": round(pressao_jus, 2) if pressao_jus is not None else None,
            "atende_norma": atende,
            "observacoes": obs,
        }

        if best_result is None or (atende and not best_result.get("atende_norma")):
            best_result = result
            if atende:
                break

    if best_result is None:
        best_result = {
            "diametro_mm": DIAMETROS_COMERCIAIS[-1],
            "velocidade_ms": 0,
            "perda_carga_m": 0,
            "perda_carga_unitaria": 0,
            "pressao_jusante": None,
            "atende_norma": False,
            "observacoes": ["Nenhum diâmetro comercial atende todos os critérios"],
        }

    return best_result


def dimension_water_network(
    trechos: List[dict],
    formula: str = "hazen-williams",
    c_hw: float = 140,
    vel_min: float = 0.6,
    vel_max: float = 3.5,
    pressao_min: float = 10.0,
    pressao_max: float = 50.0,
    diam_min_mm: int = 50,
) -> List[dict]:
    """Dimension all segments in a water distribution network."""
    results = []
    for t in trechos:
        result = dimension_water_segment(
            vazao_lps=t["vazao_lps"],
            comprimento=t["comprimento"],
            cota_montante=t["cota_montante"],
            cota_jusante=t["cota_jusante"],
            material=t.get("material", "PVC"),
            pressao_montante=t.get("pressao_montante"),
            formula=formula,
            c_hw=c_hw,
            vel_min=vel_min,
            vel_max=vel_max,
            pressao_min=pressao_min,
            pressao_max=pressao_max,
            diam_min_mm=diam_min_mm,
        )
        result["id"] = t["id"]
        results.append(result)
    return results
