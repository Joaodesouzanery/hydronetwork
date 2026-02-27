"""
QEsg Engine — Sewer network dimensioning algorithms.

Based on Brazilian standards NBR 9649 and NBR 14486.
Implements Manning's equation for gravity sewer design.

References:
- Sketua/QEsg QGIS plugin
- NBR 9649: Projeto de redes coletoras de esgoto sanitário
"""

import math
from typing import List, Tuple

# Standard commercial diameters for sewer pipes (mm)
DIAMETROS_COMERCIAIS = [100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1200, 1500]


def manning_velocity(rh: float, slope: float, n: float) -> float:
    """Manning's equation: V = (1/n) * Rh^(2/3) * S^(1/2)"""
    if slope <= 0 or rh <= 0:
        return 0.0
    return (1.0 / n) * (rh ** (2.0 / 3.0)) * (slope ** 0.5)


def circular_section_properties(y_d: float, diameter_m: float) -> Tuple[float, float, float]:
    """
    Calculate area, perimeter, and hydraulic radius for a circular section
    at a given y/D ratio.

    Returns: (area, wetted_perimeter, hydraulic_radius)
    """
    if y_d <= 0 or y_d >= 1.0:
        y_d = min(max(y_d, 0.01), 0.99)

    r = diameter_m / 2.0
    theta = 2.0 * math.acos(1.0 - y_d)

    area = (r ** 2 / 2.0) * (theta - math.sin(theta))
    wetted_perimeter = r * theta
    hydraulic_radius = area / wetted_perimeter if wetted_perimeter > 0 else 0

    return area, wetted_perimeter, hydraulic_radius


def calculate_tractive_stress(rh: float, slope: float, density: float = 1000.0) -> float:
    """Calculate tractive stress: τ = γ * Rh * S (Pa)"""
    g = 9.81
    return density * g * rh * slope


def dimension_sewer_segment(
    vazao_lps: float,
    comprimento: float,
    cota_montante: float,
    cota_jusante: float,
    n: float = 0.013,
    lamina_max: float = 0.75,
    vel_min: float = 0.6,
    vel_max: float = 5.0,
    tensao_min: float = 1.0,
    diam_min_mm: int = 100,
) -> dict:
    """
    Dimension a single sewer segment.

    Returns dict with: diametro_mm, declividade_min, velocidade, lamina, tensao_trativa, atende_norma
    """
    vazao_m3s = vazao_lps / 1000.0
    slope = (cota_montante - cota_jusante) / comprimento if comprimento > 0 else 0

    if slope < 0:
        slope = abs(slope)

    observacoes = []
    best_diameter = diam_min_mm
    best_result = None

    for diam_mm in DIAMETROS_COMERCIAIS:
        if diam_mm < diam_min_mm:
            continue

        diam_m = diam_mm / 1000.0

        # Binary search for y/D that satisfies Q = A * V
        y_d_low, y_d_high = 0.01, lamina_max
        y_d = lamina_max / 2

        for _ in range(50):
            area, wp, rh = circular_section_properties(y_d, diam_m)
            vel = manning_velocity(rh, slope, n)
            q_calc = area * vel

            if abs(q_calc - vazao_m3s) < 1e-8:
                break
            if q_calc < vazao_m3s:
                y_d_low = y_d
            else:
                y_d_high = y_d
            y_d = (y_d_low + y_d_high) / 2

        area, wp, rh = circular_section_properties(y_d, diam_m)
        vel = manning_velocity(rh, slope, n)
        tensao = calculate_tractive_stress(rh, slope)

        # Check criteria
        atende = True
        if y_d > lamina_max:
            atende = False
        if vel < vel_min:
            atende = False
        if vel > vel_max:
            atende = False
        if tensao < tensao_min:
            atende = False

        result = {
            "diametro_mm": diam_mm,
            "declividade_min": round(slope, 6),
            "velocidade_ms": round(vel, 3),
            "lamina_dagua": round(y_d, 4),
            "tensao_trativa": round(tensao, 3),
            "atende_norma": atende,
        }

        if best_result is None or (atende and not best_result.get("atende_norma")):
            best_result = result
            best_diameter = diam_mm
            if atende:
                break

    if best_result is None:
        best_result = {
            "diametro_mm": DIAMETROS_COMERCIAIS[-1],
            "declividade_min": round(slope, 6),
            "velocidade_ms": 0,
            "lamina_dagua": 0,
            "tensao_trativa": 0,
            "atende_norma": False,
        }
        observacoes.append("Nenhum diâmetro comercial atende todos os critérios")

    if slope <= 0:
        observacoes.append("Declividade nula ou negativa - verificar cotas")

    best_result["observacoes"] = observacoes
    return best_result


def dimension_sewer_network(
    trechos: List[dict],
    n: float = 0.013,
    lamina_max: float = 0.75,
    vel_min: float = 0.6,
    vel_max: float = 5.0,
    tensao_min: float = 1.0,
    diam_min_mm: int = 100,
) -> List[dict]:
    """Dimension all segments in a sewer network."""
    results = []
    for t in trechos:
        result = dimension_sewer_segment(
            vazao_lps=t["vazao_lps"],
            comprimento=t["comprimento"],
            cota_montante=t["cota_montante"],
            cota_jusante=t["cota_jusante"],
            n=n,
            lamina_max=lamina_max,
            vel_min=vel_min,
            vel_max=vel_max,
            tensao_min=tensao_min,
            diam_min_mm=diam_min_mm,
        )
        result["id"] = t["id"]
        results.append(result)
    return results
