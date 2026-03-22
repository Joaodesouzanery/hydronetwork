/**
 * QEsg/QWater Panel — Reusable tabbed panel wrapping the standalone modules.
 * Used inline in TopografiaModule AND as standalone via QEsgWaterModule.
 *
 * Now delegates to SewerModule and WaterModule to avoid code duplication.
 */

import { useState, lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Waves, Droplets } from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";

const SewerModule = lazy(() => import("@/components/hydronetwork/modules/SewerModule").then(m => ({ default: m.SewerModule })));
const WaterModule = lazy(() => import("@/components/hydronetwork/modules/WaterModule").then(m => ({ default: m.WaterModule })));

interface QEsgWaterPanelProps {
  pontos?: PontoTopografico[];
  trechos?: Trecho[];
  onTrechosChange?: (t: Trecho[]) => void;
}

export const QEsgWaterPanel = ({ pontos, trechos, onTrechosChange }: QEsgWaterPanelProps) => {
  const [activeTab, setActiveTab] = useState<"qesg" | "qwater">("qesg");

  return (
    <Tabs value={activeTab} onValueChange={v => setActiveTab(v as "qesg" | "qwater")}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="qesg" className="flex items-center gap-1">
          <Waves className="h-4 w-4" /> Esgoto
        </TabsTrigger>
        <TabsTrigger value="qwater" className="flex items-center gap-1">
          <Droplets className="h-4 w-4" /> Água
        </TabsTrigger>
      </TabsList>

      <TabsContent value="qesg">
        <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin h-6 w-6 border-b-2 border-primary" /></div>}>
          <SewerModule pontos={pontos} trechos={trechos} onTrechosChange={onTrechosChange} />
        </Suspense>
      </TabsContent>

      <TabsContent value="qwater">
        <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin h-6 w-6 border-b-2 border-primary" /></div>}>
          <WaterModule pontos={pontos} trechos={trechos} onTrechosChange={onTrechosChange} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
};
