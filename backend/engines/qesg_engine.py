"""
QEsg Engine — Sewer network dimensioning algorithms.

Faithful port of jorgealmerio/QEsg (QGIS plugin) core formulas.
Based on Brazilian standards NBR 9649 and NBR 14486.
Implements Manning's equation for gravity sewer design.

Key formulas ported from QEsg_03Dimensionamento.py:
- CalcDiametro: D = [n·Q / (√I·(A/D²)·(Rh/D)^(2/3))]^(3/8) × 1000
- CalcTheta: binary search with M threshold 0.335282
- Tensão trativa: τ = 10000·Rh·I (Pa)
- Velocidade crítica: v_c = 6·√(g·Rh)
- Declividade mínima: I_min = 0.0055·Q^(-0.47)

References:
- https://github.com/jorgealmerio/QEsg
- NBR 9649: Projeto de redes coletoras de esgoto sanitário
- Ariovaldo Nuvolari, "Esgoto sanitário" (referenced in QEsg source)
"""

import math
from typing import List, Tuple, Optional

# Standard commercial diameters for sewer pipes (mm) with default Manning n
# Format: (diameter_mm, manning_n)
TUBOS_PVC = [
    (100, 0.013), (150, 0.013), (200, 0.013), (250, 0.013),
    (300, 0.013), (350, 0.013), (400, 0.013), (450, 0.013),
    (500, 0.013), (600, 0.013), (700, 0.013), (800, 0.013),
    (900, 0.013), (1000, 0.013), (1200, 0.013), (1500, 0.013),
]

TUBOS_CONCRETO = [
    (300, 0.015), (400, 0.015), (500, 0.015), (600, 0.015),
    (700, 0.015), (800, 0.015), (900, 0.015), (1000, 0.015),
    (1200, 0.015), (1500, 0.015), (2000, 0.015),
]

DIAMETROS_COMERCIAIS = [d for d, _ in TUBOS_PVC]


def theta_from_yd(y_d: float) -> float:
    """Central angle θ from y/D ratio: θ = 2·arccos(1 - 2·y/D)"""
    y_d = min(max(y_d, 0.001), 0.999)
    return 2.0 * math.acos(1.0 - 2.0 * y_d)


def yd_from_theta(theta: float) -> float:
    """y/D from central angle θ: y/D = 0.5·(1 - cos(θ/2))"""
    return 0.5 * (1.0 - math.cos(theta / 2.0))


def calc_area_normalized(theta: float) -> float:
    """Normalized area A/D² = (θ - sin θ) / 8"""
    return (theta - math.sin(theta)) / 8.0


def calc_rh_normalized(theta: float) -> float:
    """Normalized hydraulic radius Rh/D = (θ - sin θ) / (4θ)"""
    if theta <= 0:
        return 0.0
    return (theta - math.sin(theta)) / (4.0 * theta)


def manning_velocity(rh: float, slope: float, n: float) -> float:
    """Manning's equation: V = (1/n) · Rh^(2/3) · S^(1/2)"""
    if slope <= 0 or rh <= 0:
        return 0.0
    return (1.0 / n) * (rh ** (2.0 / 3.0)) * (slope ** 0.5)


def calc_tractive_stress(rh: float, slope: float) -> float:
    """
    Tractive stress as per QEsg: τ = 10000 · Rh · I (Pa)
    The constant 10000 = γ_water ≈ ρ·g ≈ 1000 × 9.81 ≈ 9810 ≈ 10000 N/m³
    """
    return 10000.0 * rh * slope


def calc_critical_velocity(rh: float) -> float:
    """Critical velocity: v_c = 6·√(g·Rh) where g = 9.81 m/s²"""
    if rh <= 0:
        return 0.0
    return 6.0 * math.sqrt(9.81 * rh)


def calc_min_slope(vazao_lps: float) -> float:
    """
    Minimum slope for self-cleansing (QEsg formula):
    I_min = 0.0055 · Q^(-0.47)
    """
    if vazao_lps <= 0:
        return 0.005  # fallback
    return 0.0055 * (vazao_lps ** (-0.47))


def calc_diameter_analytical(q_lps: float, n: float, slope: float, y_d: float) -> float:
    """
    Analytical diameter calculation (QEsg CalcDiametro):
    D = [n·Q / (√I · (A/D²) · (Rh/D)^(2/3))]^(3/8) × 1000

    Returns diameter in mm.
    """
    if slope <= 0 or q_lps <= 0:
        return 0.0

    q_m3s = q_lps / 1000.0
    theta = theta_from_yd(y_d)
    am_d2 = calc_area_normalized(theta)
    rh_d = calc_rh_normalized(theta)

    if am_d2 <= 0 or rh_d <= 0:
        return 0.0

    diam_m = (n * q_m3s / (slope ** 0.5 * am_d2 * rh_d ** (2.0 / 3.0))) ** (3.0 / 8.0)
    return diam_m * 1000.0


def calc_theta_for_flow(q_lps: float, n: float, slope: float, diam_mm: float, max_iter: int = 1000) -> float:
    """
    Find θ (central angle) for given flow conditions (QEsg CalcTheta).
    Uses binary search with M = n·Q/(√I·D^(8/3)) parameter.

    M threshold 0.335282 indicates pipe under pressure (full flow).
    """
    if slope <= 0 or diam_mm <= 0:
        return 0.0

    diam_m = diam_mm / 1000.0
    q_m3s = q_lps / 1000.0
    M = n * q_m3s / (slope ** 0.5 * diam_m ** (8.0 / 3.0))

    # If M >= 0.335282, pipe flows full (under pressure)
    if M >= 0.335282:
        return 2.0 * math.pi

    # Binary search for θ
    theta_low = 0.01
    theta_high = 2.0 * math.pi
    theta = math.pi  # start at half-full

    for _ in range(max_iter):
        am_d2 = calc_area_normalized(theta)
        rh_d = calc_rh_normalized(theta)

        if rh_d <= 0:
            theta_low = theta
            theta = (theta_low + theta_high) / 2.0
            continue

        m_calc = am_d2 * rh_d ** (2.0 / 3.0)

        if abs(m_calc - M) < 1e-10:
            break
        if m_calc < M:
            theta_low = theta
        else:
            theta_high = theta
        theta = (theta_low + theta_high) / 2.0

    return theta


def select_commercial_diameter(diam_calc_mm: float, diam_min_mm: int, tubos=None) -> Tuple[int, float]:
    """Select smallest commercial diameter >= calculated diameter and >= minimum."""
    if tubos is None:
        tubos = TUBOS_PVC
    for d, n_val in tubos:
        if d >= max(diam_calc_mm, diam_min_mm):
            return d, n_val
    return tubos[-1][0], tubos[-1][1]


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
    diam_min_mm: int = 150,
    tipo_tubo: str = "PVC",
) -> dict:
    """
    Dimension a single sewer segment following QEsg methodology.

    Steps:
    1. Calculate slope from elevations
    2. Check minimum slope (I_min = 0.0055·Q^(-0.47))
    3. Calculate analytical diameter
    4. Select commercial diameter
    5. Find θ (central angle) for actual flow
    6. Compute y/D, velocity, tractive stress
    7. Verify NBR 9649 criteria
    """
    observacoes = []
    vazao_m3s = vazao_lps / 1000.0
    slope = (cota_montante - cota_jusante) / comprimento if comprimento > 0 else 0

    if slope < 0:
        observacoes.append("Declividade negativa (contra-fluxo) - usando valor absoluto")
        slope = abs(slope)

    if slope == 0:
        observacoes.append("Declividade nula - usando declividade mínima")
        slope = calc_min_slope(vazao_lps)

    # Step 1: Check minimum slope
    i_min = calc_min_slope(vazao_lps)
    slope_used = max(slope, i_min)
    if slope < i_min:
        observacoes.append(f"Declividade ({slope:.6f}) abaixo da mínima ({i_min:.6f})")

    # Step 2: Select pipe material
    tubos = TUBOS_PVC if tipo_tubo.upper() in ("PVC", "PEAD", "PE") else TUBOS_CONCRETO

    # Step 3: Analytical diameter calculation
    diam_calc = calc_diameter_analytical(vazao_lps, n, slope_used, lamina_max)

    # Step 4: Select commercial diameter
    diam_mm, n_tubo = select_commercial_diameter(diam_calc, diam_min_mm, tubos)
    diam_m = diam_mm / 1000.0

    # Step 5: Find θ for actual flow in selected diameter
    theta = calc_theta_for_flow(vazao_lps, n_tubo, slope_used, diam_mm)
    y_d = yd_from_theta(theta)

    # Step 6: Compute hydraulic properties
    am_d2 = calc_area_normalized(theta)
    rh_d = calc_rh_normalized(theta)
    area = am_d2 * diam_m ** 2
    rh = rh_d * diam_m
    vel = vazao_m3s / area if area > 0 else 0
    tensao = calc_tractive_stress(rh, slope_used)
    v_crit = calc_critical_velocity(rh)

    # Step 7: Check NBR 9649 criteria
    atende = True
    if y_d > lamina_max:
        atende = False
        observacoes.append(f"y/D ({y_d:.3f}) excede máximo ({lamina_max})")
    if vel < vel_min:
        atende = False
        observacoes.append(f"Velocidade ({vel:.3f} m/s) abaixo do mínimo ({vel_min} m/s)")
    if vel > vel_max:
        atende = False
        observacoes.append(f"Velocidade ({vel:.3f} m/s) acima do máximo ({vel_max} m/s)")
    if tensao < tensao_min:
        atende = False
        observacoes.append(f"Tensão trativa ({tensao:.3f} Pa) abaixo do mínimo ({tensao_min} Pa)")

    # Check critical velocity (NBR 9649: if V > v_crit, y/D must be ≤ 0.5)
    if vel > v_crit and y_d > 0.5:
        observacoes.append(f"V > V_crítica ({v_crit:.2f} m/s) → y/D deveria ser ≤ 0.50")

    return {
        "id": "",
        "diametro_mm": diam_mm,
        "diametro_calculado_mm": round(diam_calc, 1),
        "declividade_min": round(i_min, 6),
        "declividade_usada": round(slope_used, 6),
        "velocidade_ms": round(vel, 3),
        "velocidade_critica_ms": round(v_crit, 3),
        "lamina_dagua": round(y_d, 4),
        "tensao_trativa": round(tensao, 3),
        "atende_norma": atende,
        "observacoes": observacoes,
    }


def dimension_sewer_network(
    trechos: List[dict],
    n: float = 0.013,
    lamina_max: float = 0.75,
    vel_min: float = 0.6,
    vel_max: float = 5.0,
    tensao_min: float = 1.0,
    diam_min_mm: int = 150,
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
            tipo_tubo=t.get("tipo_tubo", "PVC"),
        )
        result["id"] = t["id"]
        results.append(result)
    return results
