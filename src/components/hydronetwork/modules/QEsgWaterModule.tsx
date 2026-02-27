/**
 * QEsg/QWater Module — Standalone wrapper around QEsgWaterPanel.
 * Accessible via sidebar at /hydronetwork/qesg-qwater.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Info, Calculator } from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import { QEsgWaterPanel } from "@/components/hydronetwork/panels/QEsgWaterPanel";

interface QEsgWaterModuleProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  onTrechosChange?: (t: Trecho[]) => void;
}

export const QEsgWaterModule = ({ pontos, trechos, onTrechosChange }: QEsgWaterModuleProps) => (
  <div className="space-y-4">
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5" />
          QEsg / QWater — Dimensionamento Hidráulico
        </CardTitle>
        <CardDescription>
          Dimensionamento de redes de esgoto (Manning/NBR 9649) e água (Hazen-Williams/NBR 12218).
          Baseado nos algoritmos do QEsg e QWater — cálculos 100% no navegador.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>
            Fórmulas portadas de{" "}
            <a href="https://github.com/jorgealmerio/QEsg" target="_blank" rel="noopener noreferrer" className="underline text-blue-600">QEsg</a>
            {" "}e{" "}
            <a href="https://github.com/jorgealmerio/QWater" target="_blank" rel="noopener noreferrer" className="underline text-blue-600">QWater</a>.
          </span>
        </div>
      </CardContent>
    </Card>
    <QEsgWaterPanel pontos={pontos} trechos={trechos} onTrechosChange={onTrechosChange} />
  </div>
);
