import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import QRCode from "qrcode";

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCode: {
    id: string;
    location_name: string;
    location_description?: string;
    qr_code_data: string;
    projects: { name: string };
  };
}

export const QRCodeDialog = ({ open, onOpenChange, qrCode }: QRCodeDialogProps) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  useEffect(() => {
    if (open && qrCode.qr_code_data) {
      generateQRCode();
    }
  }, [open, qrCode.qr_code_data]);

  const generateQRCode = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(qrCode.qr_code_data, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: 'H',
      });
      setQrCodeDataUrl(dataUrl);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  const handleDownload = () => {
    if (!qrCodeDataUrl) return;

    const link = document.createElement("a");
    link.download = `qr-code-${qrCode.location_name.replace(/\s+/g, "-")}.png`;
    link.href = qrCodeDataUrl;
    link.click();
  };

  const handlePrint = () => {
    if (!qrCodeDataUrl) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    const escapeHtml = (str: string) =>
      str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const doc = printWindow.document;
    doc.write("<!DOCTYPE html><html><head></head><body></body></html>");
    doc.close();

    const style = doc.createElement("style");
    style.textContent = `
      body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
      .container { text-align: center; border: 2px solid #000; padding: 30px; border-radius: 10px; }
      h1 { margin-bottom: 10px; font-size: 24px; }
      p { margin: 5px 0; color: #666; }
      img { margin: 20px 0; }
      .instructions { margin-top: 20px; font-size: 14px; color: #333; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    `;
    doc.head.appendChild(style);
    doc.title = `QR Code - ${escapeHtml(qrCode.location_name)}`;

    const container = doc.createElement("div");
    container.className = "container";

    const h1 = doc.createElement("h1");
    h1.textContent = qrCode.location_name;
    container.appendChild(h1);

    const projectP = doc.createElement("p");
    const strong = doc.createElement("strong");
    strong.textContent = "Projeto: ";
    projectP.appendChild(strong);
    projectP.appendChild(doc.createTextNode(qrCode.projects.name));
    container.appendChild(projectP);

    if (qrCode.location_description) {
      const descP = doc.createElement("p");
      descP.textContent = qrCode.location_description;
      container.appendChild(descP);
    }

    const img = doc.createElement("img");
    img.src = qrCodeDataUrl;
    img.alt = "QR Code";
    container.appendChild(img);

    const instructions = doc.createElement("div");
    instructions.className = "instructions";
    const instrP1 = doc.createElement("p");
    const instrStrong = doc.createElement("strong");
    instrStrong.textContent = "Escaneie este QR Code para solicitar manutenção";
    instrP1.appendChild(instrStrong);
    instructions.appendChild(instrP1);
    const instrP2 = doc.createElement("p");
    instrP2.textContent = "Aponte a câmera do celular para o código acima";
    instructions.appendChild(instrP2);
    container.appendChild(instructions);

    doc.body.appendChild(container);
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{qrCode.location_name}</DialogTitle>
          <DialogDescription>
            Projeto: {qrCode.projects.name}
            {qrCode.location_description && (
              <span className="block mt-1">{qrCode.location_description}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4 py-4">
          {qrCodeDataUrl ? (
            <div className="bg-white p-4 border-2 border-gray-200">
              <img 
                src={qrCodeDataUrl} 
                alt="QR Code" 
                className="w-[300px] h-[300px]"
              />
            </div>
          ) : (
            <div className="w-[300px] h-[300px] flex items-center justify-center bg-gray-100">
              <p className="text-muted-foreground">Gerando QR Code...</p>
            </div>
          )}
          
          <div className="text-center text-sm text-muted-foreground">
            <p>Escaneie este QR Code para solicitar manutenção</p>
            <p className="text-xs mt-1 max-w-md break-all">
              Link: <span className="font-mono">{qrCode.qr_code_data}</span>
            </p>
          </div>

          <div className="flex gap-2 w-full">
            <Button 
              onClick={handleDownload} 
              variant="outline" 
              className="flex-1"
              disabled={!qrCodeDataUrl}
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar PNG
            </Button>
            <Button 
              onClick={handlePrint} 
              className="flex-1"
              disabled={!qrCodeDataUrl}
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
