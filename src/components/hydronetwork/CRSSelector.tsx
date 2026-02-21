/**
 * CRSSelector — Mandatory CRS selection for data import.
 * Supports: Geographic (WGS84/SIRGAS2000), UTM (zones 18-25), Custom EPSG.
 * Nothing gets imported without a defined CRS.
 */
import React, { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Globe, MapPin, AlertTriangle, Check, Info } from "lucide-react";
import {
  ImportCRSConfig, CoordinateSystemType, DatumType,
  BRAZIL_UTM_ZONES, DATUMS, autoDetectCRS, validateUTMRange,
} from "@/engine/coordinateTransform";

interface CRSSelectorProps {
  /** Callback when CRS is confirmed */
  onCRSSelected: (config: ImportCRSConfig) => void;
  /** Sample coordinates from the imported file for auto-detection */
  sampleCoordinates?: { x: number; y: number }[];
  /** Initial CRS config if already set */
  initialConfig?: ImportCRSConfig;
  /** Compact mode for inline display */
  compact?: boolean;
}

export const CRSSelector: React.FC<CRSSelectorProps> = ({
  onCRSSelected,
  sampleCoordinates,
  initialConfig,
  compact = false,
}) => {
  const [systemType, setSystemType] = useState<CoordinateSystemType>(
    initialConfig?.type || "utm"
  );
  const [datum, setDatum] = useState<DatumType>(
    initialConfig?.datum || "SIRGAS2000"
  );
  const [utmZone, setUtmZone] = useState<number>(
    initialConfig?.utmZone || 23
  );
  const [hemisphere, setHemisphere] = useState<"N" | "S">(
    initialConfig?.hemisphere || "S"
  );
  const [confirmed, setConfirmed] = useState(!!initialConfig);
  const [autoDetected, setAutoDetected] = useState<ImportCRSConfig | null>(null);

  // Auto-detect CRS from sample coordinates
  useEffect(() => {
    if (sampleCoordinates && sampleCoordinates.length > 0) {
      const detected = autoDetectCRS(sampleCoordinates);
      if (detected) {
        setAutoDetected(detected);
        if (!initialConfig) {
          setSystemType(detected.type);
          setDatum(detected.datum);
          if (detected.utmZone) setUtmZone(detected.utmZone);
          if (detected.hemisphere) setHemisphere(detected.hemisphere);
        }
      }
    }
  }, [sampleCoordinates, initialConfig]);

  // Validate UTM coordinates from sample
  const utmValidation = useMemo(() => {
    if (systemType !== "utm" || !sampleCoordinates || sampleCoordinates.length === 0) return null;
    const issues: string[] = [];
    let invalidCount = 0;
    for (const pt of sampleCoordinates.slice(0, 10)) {
      const result = validateUTMRange(pt.x, pt.y);
      if (!result.valid) {
        invalidCount++;
        if (issues.length === 0 && result.warning) issues.push(result.warning);
      }
    }
    if (invalidCount > 0) {
      return { valid: false, message: issues[0] || `${invalidCount} pontos fora da faixa UTM.` };
    }
    return { valid: true, message: "" };
  }, [systemType, sampleCoordinates]);

  const handleConfirm = () => {
    const config: ImportCRSConfig = {
      type: systemType,
      datum,
      ...(systemType === "utm" && { utmZone, hemisphere }),
    };
    setConfirmed(true);
    onCRSSelected(config);
  };

  const currentConfig: ImportCRSConfig = {
    type: systemType,
    datum,
    ...(systemType === "utm" && { utmZone, hemisphere }),
  };

  if (compact && confirmed) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Check className="h-4 w-4 text-green-500" />
        <span className="font-medium">CRS:</span>
        <Badge variant="secondary" className="text-xs">
          {systemType === "geographic"
            ? `Geográfico (${datum})`
            : `UTM ${utmZone}${hemisphere} — ${DATUMS[datum].label}`}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={() => setConfirmed(false)}
        >
          Alterar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 border border-border rounded-lg p-3 bg-card">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">Sistema de Coordenadas (CRS)</span>
        {!confirmed && (
          <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
        )}
      </div>

      {autoDetected && !confirmed && (
        <Alert className="py-2">
          <Info className="h-3 w-3" />
          <AlertDescription className="text-xs">
            Detecção automática: <strong>
              {autoDetected.type === "geographic"
                ? "Geográfico (Lat/Long)"
                : `UTM ${autoDetected.utmZone}${autoDetected.hemisphere}`}
            </strong>. Confirme ou altere abaixo.
          </AlertDescription>
        </Alert>
      )}

      {/* System Type */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Tipo de Sistema</Label>
        <RadioGroup
          value={systemType}
          onValueChange={(v) => { setSystemType(v as CoordinateSystemType); setConfirmed(false); }}
          className="flex flex-wrap gap-3"
        >
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="geographic" id="crs-geo" />
            <Label htmlFor="crs-geo" className="text-xs cursor-pointer">
              Geográfico (Lat/Long)
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="utm" id="crs-utm" />
            <Label htmlFor="crs-utm" className="text-xs cursor-pointer">
              Projetado (UTM)
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Datum Selection */}
      <div className="space-y-1">
        <Label className="text-xs font-medium">Datum</Label>
        <Select value={datum} onValueChange={(v) => { setDatum(v as DatumType); setConfirmed(false); }}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SIRGAS2000">SIRGAS 2000</SelectItem>
            <SelectItem value="WGS84">WGS 84</SelectItem>
            <SelectItem value="SAD69">SAD 69</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* UTM Zone Selection */}
      {systemType === "utm" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs font-medium">Fuso UTM</Label>
            <Select
              value={String(utmZone)}
              onValueChange={(v) => { setUtmZone(parseInt(v)); setConfirmed(false); }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRAZIL_UTM_ZONES.map(z => (
                  <SelectItem key={z.zone} value={String(z.zone)}>
                    {z.label} (MC {z.centralMeridian}°)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Hemisfério</Label>
            <Select
              value={hemisphere}
              onValueChange={(v) => { setHemisphere(v as "N" | "S"); setConfirmed(false); }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="S">Sul (S)</SelectItem>
                <SelectItem value="N">Norte (N)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* UTM Validation Warning */}
      {utmValidation && !utmValidation.valid && (
        <Alert className="py-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="h-3 w-3 text-amber-600" />
          <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
            {utmValidation.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Confirm Button */}
      {!confirmed && (
        <Button
          size="sm"
          className="w-full h-8 text-xs"
          onClick={handleConfirm}
        >
          <Check className="h-3 w-3 mr-1" />
          Confirmar CRS
        </Button>
      )}

      {confirmed && (
        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
          <Check className="h-3 w-3" />
          <span>
            CRS definido: {systemType === "geographic"
              ? `Geográfico (${datum})`
              : `UTM ${utmZone}${hemisphere} — ${DATUMS[datum].label}`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-xs px-2 ml-auto"
            onClick={() => setConfirmed(false)}
          >
            Alterar
          </Button>
        </div>
      )}
    </div>
  );
};

export default CRSSelector;
