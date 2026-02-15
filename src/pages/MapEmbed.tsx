import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function MapEmbed() {
  const { projectId } = useParams<{ projectId: string }>();
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMapUrl = async () => {
      if (!projectId) {
        setError("ID do projeto não fornecido");
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("projects")
          .select("interactive_map_url, name")
          .eq("id", projectId)
          .single();

        if (fetchError) {
          setError("Projeto não encontrado");
          setLoading(false);
          return;
        }

        if (!data?.interactive_map_url) {
          setError("Nenhum mapa interativo configurado para este projeto");
          setLoading(false);
          return;
        }

        setMapUrl(data.interactive_map_url);
      } catch (err) {
        setError("Erro ao carregar mapa");
      } finally {
        setLoading(false);
      }
    };

    fetchMapUrl();
  }, [projectId]);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      src={mapUrl!}
      className="w-full h-screen border-0"
      title="Mapa Interativo"
      allow="geolocation"
    />
  );
}
