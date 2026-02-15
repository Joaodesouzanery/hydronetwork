import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Image, Calendar, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RDOPhoto {
  id: string;
  photo_url: string;
  uploaded_at: string;
  daily_report: {
    id: string;
    report_date: string;
    project: { name: string };
    construction_site: { name: string };
  };
}

const RDOPhotos = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [photos, setPhotos] = useState<RDOPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<RDOPhoto | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<RDOPhoto | null>(null);

  useEffect(() => {
    checkAuth();
    loadProjects();
  }, []);

  useEffect(() => {
    if (user) {
      loadPhotos();
    }
  }, [selectedProject, user]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setUser(session.user);
    setIsLoading(false);
  };

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    
    if (data) setProjects(data);
  };

  const loadPhotos = async () => {
    try {
      const { data: photosData, error: photosError } = await supabase
        .from('rdo_validation_photos')
        .select(`
          *,
          daily_reports!inner (
            id,
            report_date,
            project_id,
            projects (name),
            construction_sites (name)
          )
        `)
        .order('uploaded_at', { ascending: false });

      if (photosError) {
        toast.error("Erro ao carregar fotos: " + photosError.message);
        return;
      }

      let filteredPhotos = photosData || [];
      if (selectedProject !== 'all') {
        filteredPhotos = filteredPhotos.filter((photo: any) => 
          photo.daily_reports?.project_id === selectedProject
        );
      }

      const photosWithSignedUrls: RDOPhoto[] = await Promise.all(
        filteredPhotos.map(async (photo: any) => {
          const rawPath: string = photo.photo_url || "";
          const path = rawPath.includes('rdo-photos/')
            ? rawPath.split('rdo-photos/')[1]
            : rawPath;

          let signedUrl = rawPath;
          try {
            const { data: signed } = await supabase.storage
              .from('rdo-photos')
              .createSignedUrl(path, 60 * 60);
            if (signed?.signedUrl) {
              signedUrl = signed.signedUrl;
            }
          } catch (error) {
            console.error('Erro ao gerar URL assinada da foto:', error);
          }

          return {
            id: photo.id,
            photo_url: signedUrl,
            uploaded_at: photo.uploaded_at,
            daily_report: {
              id: photo.daily_reports.id,
              report_date: photo.daily_reports.report_date,
              project: photo.daily_reports.projects,
              construction_site: photo.daily_reports.construction_sites
            }
          } as RDOPhoto;
        })
      );

      setPhotos(photosWithSignedUrls);
    } catch (error: any) {
      toast.error("Erro ao carregar fotos: " + error.message);
    }
  };

  const handleDeletePhoto = async () => {
    if (!photoToDelete) return;

    try {
      // Extract file path from URL
      const urlParts = photoToDelete.photo_url.split('/');
      const filePath = urlParts.slice(urlParts.indexOf('rdo-photos') + 1).join('/');

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('rdo-photos')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('rdo_validation_photos')
        .delete()
        .eq('id', photoToDelete.id);

      if (dbError) throw dbError;

      toast.success("Foto excluída com sucesso!");
      loadPhotos();
      setPhotoToDelete(null);
    } catch (error: any) {
      toast.error("Erro ao excluir foto: " + error.message);
    }
  };

  const groupedPhotos = photos.reduce((acc, photo) => {
    const rdoId = photo.daily_report.id;
    if (!acc[rdoId]) {
      acc[rdoId] = {
        rdo: photo.daily_report,
        photos: []
      };
    }
    acc[rdoId].photos.push(photo);
    return acc;
  }, {} as Record<string, { rdo: any; photos: RDOPhoto[] }>);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="text-center">
          <Building2 className="w-12 h-12 mx-auto text-primary animate-pulse mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <Building2 className="w-6 h-6 mr-2" />
              <span className="font-bold">ConstruData</span>
            </Button>
            <h1 className="text-xl font-semibold">Fotos de Validação dos RDOs</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Filtrar por Projeto</label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os projetos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os projetos</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Photos Grid */}
        {Object.keys(groupedPhotos).length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Image className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma foto encontrada</h3>
              <p className="text-muted-foreground text-center">
                Adicione fotos de validação aos seus RDOs para visualizá-las aqui
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedPhotos).map(([rdoId, { rdo, photos }]) => (
              <Card key={rdoId}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    RDO - {new Date(rdo.report_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </CardTitle>
                  <CardDescription>
                    <div className="flex flex-col gap-1 mt-2">
                      <span className="font-medium">{rdo.project.name}</span>
                      <span className="flex items-center gap-1 text-sm">
                        <MapPin className="w-4 h-4" />
                        {rdo.construction_site.name}
                      </span>
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {photos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <div 
                          className="aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setSelectedPhoto(photo)}
                        >
                          <img
                            src={photo.photo_url}
                            alt={`Foto de ${new Date(photo.uploaded_at).toLocaleDateString('pt-BR')}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                          onClick={() => setPhotoToDelete(photo)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <div className="mt-2 text-xs text-muted-foreground text-center">
                          {new Date(photo.uploaded_at).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Photo Preview Dialog */}
      {selectedPhoto && (
        <AlertDialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
          <AlertDialogContent className="max-w-4xl">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Foto de {new Date(selectedPhoto.uploaded_at).toLocaleDateString('pt-BR')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {selectedPhoto.daily_report.project.name} - {selectedPhoto.daily_report.construction_site.name}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="max-h-[70vh] overflow-auto">
              <img
                src={selectedPhoto.photo_url}
                alt="Preview"
                className="w-full h-auto rounded-lg"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Fechar</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete Confirmation Dialog */}
      {photoToDelete && (
        <AlertDialog open={!!photoToDelete} onOpenChange={() => setPhotoToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta foto? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeletePhoto}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default RDOPhotos;
