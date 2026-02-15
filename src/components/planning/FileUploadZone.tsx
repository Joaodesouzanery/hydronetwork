import { useCallback, useState } from "react";
import { Upload, X, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface FileUploadZoneProps {
  label: string;
  accept: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  preview: Record<string, unknown>[];
  errors: string[];
  validCount?: number;
}

export function FileUploadZone({ label, accept, file, onFileChange, preview, errors, validCount }: FileUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onFileChange(f);
  }, [onFileChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFileChange(f);
  };

  if (file && errors.length === 0) {
    const previewRows = preview.slice(0, 5);
    const headers = previewRows.length > 0 ? Object.keys(previewRows[0]) : [];

    return (
      <div className="border border-border rounded-lg p-4 bg-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="font-medium text-sm">{file.name}</span>
            {validCount !== undefined && (
              <span className="text-xs text-muted-foreground">({validCount} registros)</span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => onFileChange(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {previewRows.length > 0 && (
          <div className="overflow-x-auto max-h-48">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map(h => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, i) => (
                  <TableRow key={i}>
                    {headers.map(h => <TableCell key={h} className="text-xs py-1">{String((row as any)[h] ?? '')}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
        onClick={() => document.getElementById(`file-${label}`)?.click()}
      >
        <input id={`file-${label}`} type="file" accept={accept} className="hidden" onChange={handleChange} />
        <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-1">Arraste ou clique para selecionar (.csv, .xlsx, .xls)</p>
        <p className="text-xs text-muted-foreground">Limite: 10MB</p>
      </div>
      {errors.length > 0 && (
        <div className="mt-2 space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="text-xs text-destructive">{err}</p>
          ))}
        </div>
      )}
    </div>
  );
}
