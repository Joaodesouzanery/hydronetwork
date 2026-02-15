import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, MapPin, Camera, Cloud, Thermometer, Droplets, Wind, Plus, Eye, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeatherData } from "@/hooks/useWeatherData";

const RDO = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [obras, setObras] = useState<any[]>([]);
  const [selectedObra, setSelectedObra] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [rdoData, setRdoData] = useState({
    data: new Date().toISOString().split('T')[0],
    condicao_terreno: "",
    observacoes_gerais: "",
    localizacao_validada: "",
    fotos_validacao: [] as string[]
  });

  const { location, error: geoError, getCurrentLocation } = useGeolocation();
  const { weather, isLoading: weatherLoading, fetchWeather } = useWeatherData();

  useEffect(() => {
    checkAuth();
    loadObras();
  }, []);

  useEffect(() => {
    if (location) {
      setRdoData(prev => ({
        ...prev,
        localizacao_validada: `${location.latitude}, ${location.longitude}`
      }));
    }
  }, [location]);

  useEffect(() => {
    if (selectedObra && location) {
      fetchWeather(location.latitude, location.longitude);
    }
  }, [selectedObra, location]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setUser(session.user);
  };

  const loadObras = async () => {
    const { data } = await supabase
      .from('obras')
      .select('*')
      .eq('status', 'ativa')
      .order('created_at', { ascending: false });
    
    if (data) setObras(data);
  };

  const handleGetLocation = () => {
    getCurrentLocation();
    toast.info("Obtendo localização...");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedObra) {
      toast.error("Selecione uma obra");
      return;
    }

    setIsLoading(true);
    
    try {
      const rdoPayload = {
        obra_id: selectedObra,
        data: rdoData.data,
        condicao_terreno: rdoData.condicao_terreno,
        observacoes_gerais: rdoData.observacoes_gerais,
        localizacao_validada: rdoData.localizacao_validada,
        fotos_validacao: rdoData.fotos_validacao,
        clima_temperatura: weather?.temperature || null,
        clima_umidade: weather?.humidity || null,
        clima_vento_velocidade: weather?.windSpeed || null,
        clima_previsao_chuva: weather?.willRain || null
      };

      const { error } = await supabase
        .from('rdos')
        .insert([rdoPayload]);

      if (error) throw error;

      toast.success("RDO criado com sucesso!");
      
      // Reset form
      setRdoData({
        data: new Date().toISOString().split('T')[0],
        condicao_terreno: "",
        observacoes_gerais: "",
        localizacao_validada: "",
        fotos_validacao: []
      });
      setSelectedObra("");
      
    } catch (error: any) {
      toast.error("Erro ao criar RDO: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <Building2 className="w-6 h-6 mr-2" />
              <span className="font-bold">ConstruData</span>
            </Button>
            <h1 className="text-xl font-semibold">Relatório Diário de Obra (RDO)</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário Principal */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Novo RDO</CardTitle>
                <CardDescription>Preencha as informações do relatório diário</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="obra">Obra *</Label>
                      <Select value={selectedObra} onValueChange={setSelectedObra}>
                        <SelectTrigger id="obra">
                          <SelectValue placeholder="Selecione a obra" />
                        </SelectTrigger>
                        <SelectContent>
                          {obras.map(obra => (
                            <SelectItem key={obra.id} value={obra.id}>
                              {obra.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="data">Data *</Label>
                      <Input
                        id="data"
                        type="date"
                        value={rdoData.data}
                        onChange={(e) => setRdoData(prev => ({ ...prev, data: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="terreno">Condição do Terreno</Label>
                    <Select 
                      value={rdoData.condicao_terreno} 
                      onValueChange={(value) => setRdoData(prev => ({ ...prev, condicao_terreno: value }))}
                    >
                      <SelectTrigger id="terreno">
                        <SelectValue placeholder="Selecione a condição" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="seco">Seco</SelectItem>
                        <SelectItem value="umido">Úmido</SelectItem>
                        <SelectItem value="lamacento">Lamacento</SelectItem>
                        <SelectItem value="alagado">Alagado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="localizacao">
                      Localização
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        className="ml-2"
                        onClick={handleGetLocation}
                      >
                        <MapPin className="w-4 h-4 mr-1" />
                        Obter GPS
                      </Button>
                    </Label>
                    <Input
                      id="localizacao"
                      value={rdoData.localizacao_validada}
                      onChange={(e) => setRdoData(prev => ({ ...prev, localizacao_validada: e.target.value }))}
                      placeholder="Latitude, Longitude"
                      readOnly
                    />
                    {geoError && (
                      <p className="text-sm text-destructive">{geoError}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="observacoes">Observações Gerais</Label>
                    <Textarea
                      id="observacoes"
                      value={rdoData.observacoes_gerais}
                      onChange={(e) => setRdoData(prev => ({ ...prev, observacoes_gerais: e.target.value }))}
                      placeholder="Descreva as atividades realizadas, problemas encontrados, etc."
                      rows={6}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      <Camera className="w-4 h-4 inline mr-1" />
                      Fotos de Validação
                    </Label>
                    <Button type="button" variant="outline" className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Fotos
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Tire fotos do local para validar a localização
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Salvando..." : "Criar RDO"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Painel de Clima */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="w-5 h-5" />
                  Dados Climáticos
                </CardTitle>
                <CardDescription>
                  {weather ? "Dados atualizados" : "Aguardando localização"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {weatherLoading ? (
                  <div className="text-center py-8">
                    <Cloud className="w-12 h-12 mx-auto text-primary animate-pulse mb-2" />
                    <p className="text-sm text-muted-foreground">Carregando clima...</p>
                  </div>
                ) : weather ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Thermometer className="w-5 h-5 text-orange-500" />
                        <span className="text-sm font-medium">Temperatura</span>
                      </div>
                      <span className="text-lg font-bold">{weather.temperature}°C</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Droplets className="w-5 h-5 text-blue-500" />
                        <span className="text-sm font-medium">Umidade</span>
                      </div>
                      <span className="text-lg font-bold">{weather.humidity}%</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Wind className="w-5 h-5 text-cyan-500" />
                        <span className="text-sm font-medium">Vento</span>
                      </div>
                      <span className="text-lg font-bold">{weather.windSpeed} km/h</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-5 h-5 text-gray-500" />
                        <span className="text-sm font-medium">Previsão de Chuva</span>
                      </div>
                      <span className={`text-lg font-bold ${weather.willRain ? 'text-blue-600' : 'text-green-600'}`}>
                        {weather.willRain ? 'Sim' : 'Não'}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                      Última atualização: {new Date().toLocaleTimeString('pt-BR')}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Cloud className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Selecione uma obra e obtenha a localização para ver os dados climáticos
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>• Registre o RDO diariamente para melhor controle</p>
                <p>• As fotos ajudam na validação da localização</p>
                <p>• Dados climáticos são salvos automaticamente</p>
                <p>• Descreva detalhadamente as atividades realizadas</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RDO;
