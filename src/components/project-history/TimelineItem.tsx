import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Camera, Video, FileText, MapPin, User, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimelineRecord {
  id: string;
  type: string;
  date: Date;
  title: string;
  description?: string;
  user?: string;
  location?: string;
  hasPhoto?: boolean;
  hasVideo?: boolean;
  hasDocument?: boolean;
  metadata?: Record<string, any>;
}

interface TimelineItemProps {
  record: TimelineRecord;
  config: { label: string; icon: React.ElementType; color: string };
  isLast: boolean;
}

export function TimelineItem({ record, config, isLast }: TimelineItemProps) {
  const Icon = config.icon;

  return (
    <div className="flex gap-4">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center text-white shadow-md`}>
          <Icon className="h-5 w-5" />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-border mt-2" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="bg-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-2">
            <div>
              <Badge variant="secondary" className="mb-2">
                {config.label}
              </Badge>
              <h4 className="font-semibold text-foreground">{record.title}</h4>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <span>{format(record.date, "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
              <div>{format(record.date, "HH:mm", { locale: ptBR })}</div>
            </div>
          </div>

          {record.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {record.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {record.user && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {record.user}
              </span>
            )}
            {record.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {record.location}
              </span>
            )}
          </div>

          {/* Evidence indicators */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t">
            <div className="flex items-center gap-2">
              {record.hasPhoto && (
                <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50">
                  <Camera className="h-3 w-3" />
                  Foto
                </Badge>
              )}
              {record.hasVideo && (
                <Badge variant="outline" className="gap-1 text-blue-600 border-blue-200 bg-blue-50">
                  <Video className="h-3 w-3" />
                  Vídeo
                </Badge>
              )}
              {record.hasDocument && (
                <Badge variant="outline" className="gap-1 text-orange-600 border-orange-200 bg-orange-50">
                  <FileText className="h-3 w-3" />
                  Doc
                </Badge>
              )}
              {!record.hasPhoto && !record.hasVideo && !record.hasDocument && (
                <span className="text-xs text-muted-foreground italic">Sem evidência anexada</span>
              )}
            </div>

            <div className="ml-auto">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <ExternalLink className="h-3 w-3" />
                    Ver Detalhes
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full ${config.color} flex items-center justify-center text-white`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      {record.title}
                    </DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="max-h-[60vh]">
                    <div className="space-y-4 p-2">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-muted-foreground">Data:</span>
                          <p>{format(record.date, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</p>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">Tipo:</span>
                          <p>{config.label}</p>
                        </div>
                        {record.user && (
                          <div>
                            <span className="font-medium text-muted-foreground">Responsável:</span>
                            <p>{record.user}</p>
                          </div>
                        )}
                        {record.location && (
                          <div>
                            <span className="font-medium text-muted-foreground">Local:</span>
                            <p>{record.location}</p>
                          </div>
                        )}
                      </div>

                      {record.description && (
                        <div>
                          <span className="font-medium text-muted-foreground text-sm">Descrição:</span>
                          <p className="mt-1 text-sm bg-muted/50 p-3 rounded-lg">{record.description}</p>
                        </div>
                      )}

                      {/* Photos */}
                      {record.metadata?.photos_urls && record.metadata.photos_urls.length > 0 && (
                        <div>
                          <span className="font-medium text-muted-foreground text-sm">Fotos:</span>
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            {record.metadata.photos_urls.map((url: string, idx: number) => (
                              <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                <img 
                                  src={url} 
                                  alt={`Foto ${idx + 1}`} 
                                  className="w-full h-24 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Metadata details */}
                      <div className="text-xs text-muted-foreground pt-4 border-t">
                        <p>ID do Registro: {record.id}</p>
                        <p>Criado em: {format(record.date, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</p>
                      </div>
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
