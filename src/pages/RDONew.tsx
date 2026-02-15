import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Trash2, FileText, BarChart3, Eye, MapPin, Image, Cloud, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AddServiceFrontDialog } from "@/components/rdo/AddServiceFrontDialog";
import { AddConstructionSiteDialog } from "@/components/rdo/AddConstructionSiteDialog";
import { AddServiceDialog } from "@/components/rdo/AddServiceDialog";
import { RDOHistoryView } from "@/components/rdo/RDOHistoryView";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";
interface ExecutedService {
  service_id: string;
  quantity: string;
  unit: string;
  equipment_used: string;
  employee_id?: string;
  justification?: string;
}

interface CustomQuestion {
  id: string;
  question: string;
  answer: string;
  type: 'text' | 'select' | 'number';
  options?: string[];
}

const RDONew = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Data from database
  const [projects, setProjects] = useState<any[]>([]);
  const [serviceFronts, setServiceFronts] = useState<any[]>([]);
  const [constructionSites, setConstructionSites] = useState<any[]>([]);
  const [servicesCatalog, setServicesCatalog] = useState<any[]>([]);
  const [productionTargets, setProductionTargets] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Helper to get today's date in local timezone (avoids UTC shifting)
  const getTodayLocalDate = () => {
    const now = new Date();
    const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
    const local = new Date(now.getTime() - tzOffsetMs);
    return local.toISOString().split('T')[0];
  };

  // Form state
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedServiceFronts, setSelectedServiceFronts] = useState<string[]>([]);
  const [selectedConstructionSites, setSelectedConstructionSites] = useState<string[]>([]);
  const [reportDate, setReportDate] = useState<string>(getTodayLocalDate());
  const [executedServices, setExecutedServices] = useState<ExecutedService[]>([
    { service_id: "", quantity: "", unit: "", equipment_used: "" }
  ]);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [showNewQuestionDialog, setShowNewQuestionDialog] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionType, setNewQuestionType] = useState<'text' | 'select' | 'number'>('text');
  
  // Novos campos
  const [terrainCondition, setTerrainCondition] = useState("");
  const [location, setLocation] = useState("");
  const [generalObservations, setGeneralObservations] = useState("");
  const [visits, setVisits] = useState("");
  const [occurrences, setOccurrences] = useState("");
  const [validationPhotos, setValidationPhotos] = useState<File[]>([]);
  const [lastCreatedRDOId, setLastCreatedRDOId] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // PDF Export options
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [consolidateServices, setConsolidateServices] = useState(false);

  // Search filters for lists
  const [serviceFrontSearch, setServiceFrontSearch] = useState("");
  const [constructionSiteSearch, setConstructionSiteSearch] = useState("");

  // Dialog states
  const [showServiceFrontDialog, setShowServiceFrontDialog] = useState(false);
  const [showConstructionSiteDialog, setShowConstructionSiteDialog] = useState(false);
  const [showServiceDialog, setShowServiceDialog] = useState(false);

  useEffect(() => {
    checkAuth();
    loadProjects();
    loadServicesCatalog();
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadServiceFronts(selectedProject);
      loadConstructionSites(selectedProject);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedServiceFronts.length > 0) {
      selectedServiceFronts.forEach(frontId => loadProductionTargets(frontId));
    }
  }, [selectedServiceFronts]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setUser(session.user);
  };

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (data) setProjects(data);
  };

  const loadServiceFronts = async (projectId: string) => {
    const { data } = await supabase
      .from('service_fronts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (data) setServiceFronts(data);
  };

  const loadConstructionSites = async (projectId: string) => {
    const { data } = await supabase
      .from('construction_sites')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (data) setConstructionSites(data);
  };

  const loadServicesCatalog = async () => {
    const { data } = await supabase
      .from('services_catalog')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setServicesCatalog(data);
  };

  const loadEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true });
    if (data) setEmployees(data);
  };

  const loadProductionTargets = async (serviceFrontId: string) => {
    const { data } = await supabase
      .from('production_targets')
      .select('*')
      .eq('service_front_id', serviceFrontId)
      .order('created_at', { ascending: false });
    if (data) setProductionTargets(data);
  };

  const addExecutedService = () => {
    setExecutedServices([...executedServices, { service_id: "", quantity: "", unit: "", equipment_used: "", employee_id: "" }]);
  };

  const removeExecutedService = (index: number) => {
    const newServices = executedServices.filter((_, i) => i !== index);
    setExecutedServices(newServices);
  };

  const updateExecutedService = (index: number, field: keyof ExecutedService, value: string) => {
    const newServices = [...executedServices];
    newServices[index] = { ...newServices[index], [field]: value };
    
    // Update unit when service is selected
    if (field === 'service_id' && value) {
      const service = servicesCatalog.find(s => s.id === value);
      if (service) {
        newServices[index].unit = service.unit;
      }
    }

    setExecutedServices(newServices);
  };

  const checkBelowTarget = (serviceId: string, quantity: number): boolean => {
    const target = productionTargets.find(
      t => t.service_id === serviceId && new Date(t.target_date).toDateString() === new Date(reportDate).toDateString()
    );
    
    if (target && quantity < target.target_quantity) {
      return true;
    }
    return false;
  };

  const addCustomQuestion = () => {
    if (!newQuestionText.trim()) {
      toast.error("Digite uma pergunta");
      return;
    }
    
    const newQuestion: CustomQuestion = {
      id: crypto.randomUUID(),
      question: newQuestionText,
      answer: "",
      type: newQuestionType,
      options: newQuestionType === 'select' ? [] : undefined
    };
    
    setCustomQuestions([...customQuestions, newQuestion]);
    setNewQuestionText("");
    setNewQuestionType('text');
    setShowNewQuestionDialog(false);
    toast.success("Pergunta adicionada");
  };

  const updateCustomQuestion = (id: string, answer: string) => {
    setCustomQuestions(customQuestions.map(q => 
      q.id === id ? { ...q, answer } : q
    ));
  };

  const removeCustomQuestion = (id: string) => {
    setCustomQuestions(customQuestions.filter(q => q.id !== id));
  };

  const handleGetGPS = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude.toFixed(6);
          const lng = position.coords.longitude.toFixed(6);
          setLocation(`${lat}, ${lng}`);
          toast.success("Localização obtida com sucesso!");
          
          // Buscar dados climáticos
          setIsLoadingWeather(true);
          try {
            const { data, error } = await supabase.functions.invoke('weather-data', {
              body: { 
                latitude: position.coords.latitude, 
                longitude: position.coords.longitude 
              }
            });
            
            if (error) throw error;
            if (data) {
              setWeatherData(data);
              toast.success("Dados climáticos obtidos!");
            }
          } catch (error: any) {
            console.error('Erro ao buscar clima:', error);
            toast.error("Não foi possível obter dados climáticos");
          } finally {
            setIsLoadingWeather(false);
          }
        },
        (error) => {
          toast.error("Erro ao obter localização: " + error.message);
        }
      );
    } else {
      toast.error("Geolocalização não disponível neste navegador");
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setValidationPhotos([...validationPhotos, ...newFiles]);
      toast.success(`${newFiles.length} foto(s) adicionada(s)`);
    }
  };

  const removePhoto = (index: number) => {
    setValidationPhotos(validationPhotos.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProject || selectedServiceFronts.length === 0 || selectedConstructionSites.length === 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Validate observations (now required)
    if (!generalObservations || generalObservations.trim().length === 0) {
      toast.error("As observações gerais são obrigatórias");
      return;
    }

    // Validate executed services
    const validServices = executedServices.filter(s => s.service_id && s.quantity);
    if (validServices.length === 0) {
      toast.error("Adicione pelo menos um serviço executado");
      return;
    }

    // Check for below target services that need justification
    const servicesNeedingJustification = validServices.filter(s => {
      const qty = parseFloat(s.quantity);
      return checkBelowTarget(s.service_id, qty) && !s.justification;
    });

    if (servicesNeedingJustification.length > 0) {
      toast.error("Preencha as justificativas para serviços abaixo da meta");
      return;
    }

    setIsLoading(true);
    
    try {
      // Check if RDO already exists for this date
      const { data: existingRDO, error: checkError } = await supabase
        .from('daily_reports')
        .select('id')
        .eq('project_id', selectedProject)
        .eq('report_date', reportDate)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingRDO) {
        toast.error("Já existe um RDO para esta data neste projeto");
        setIsLoading(false);
        return;
      }
      // Create ONE daily report using the first selected front and construction site
      // (Note: All selected fronts/sites are included in the observations)
      const serviceFrontId = selectedServiceFronts[0];
      const constructionSiteId = selectedConstructionSites[0];
      
      // Add info about all selected fronts/sites to observations
      const selectedFrontNames = serviceFronts
        .filter(sf => selectedServiceFronts.includes(sf.id))
        .map(sf => sf.name)
        .join(', ');
      
      const selectedSiteNames = constructionSites
        .filter(cs => selectedConstructionSites.includes(cs.id))
        .map(cs => cs.name)
        .join(', ');
      
      const enhancedObservations = `${generalObservations ? generalObservations + '\n\n' : ''}Frentes de Serviço: ${selectedFrontNames}\nLocais da Obra: ${selectedSiteNames}`;

      const { data: dailyReport, error: reportError } = await supabase
        .from('daily_reports')
        .insert({
          report_date: reportDate,
          project_id: selectedProject,
          construction_site_id: constructionSiteId,
          service_front_id: serviceFrontId,
          executed_by_user_id: user.id,
          temperature: weatherData?.temperature || null,
          humidity: weatherData?.humidity || null,
          wind_speed: weatherData?.windSpeed || null,
          will_rain: weatherData?.willRain || null,
          weather_description: weatherData?.description || null,
          terrain_condition: terrainCondition || null,
          gps_location: location || null,
          general_observations: enhancedObservations || null,
          visits: visits || null,
          occurrences_summary: occurrences || null
        })
        .select()
        .single();

      if (reportError) throw reportError;
      
      // Upload validation photos
      if (validationPhotos.length > 0) {
        for (const photo of validationPhotos) {
          const fileName = `${user.id}/${dailyReport.id}/${crypto.randomUUID()}_${photo.name}`;
          
          const { error: uploadError } = await supabase.storage
            .from('rdo-photos')
            .upload(fileName, photo);

          if (uploadError) {
            console.error('Error uploading photo:', uploadError);
            continue;
          }

          const { error: insertError } = await supabase
            .from('rdo_validation_photos')
            .insert({
              daily_report_id: dailyReport.id,
              photo_url: fileName,
              created_by_user_id: user.id
            });

          if (insertError) {
            console.error('Error saving photo record:', insertError);
          }
        }
      }

      // Insert executed services
      for (const service of validServices) {
        const { data: executedService, error: serviceError } = await supabase
          .from('executed_services')
          .insert([{
            daily_report_id: dailyReport.id,
            service_id: service.service_id,
            quantity: parseFloat(service.quantity),
            unit: service.unit,
            equipment_used: service.equipment_used ? { equipment: service.equipment_used } : null,
            employee_id: service.employee_id || null,
            created_by_user_id: user.id
          }])
          .select()
          .single();

        if (serviceError) throw serviceError;

        // Add justification if below target
        if (service.justification) {
          const { error: justError } = await supabase
            .from('justifications')
            .insert([{
              daily_report_id: dailyReport.id,
              executed_service_id: executedService.id,
              reason: service.justification,
              created_by_user_id: user.id
            }]);

          if (justError) throw justError;
        }
      }

      toast.success('RDO criado com sucesso!');
      setLastCreatedRDOId(dailyReport.id);

      // Reset form
      setSelectedServiceFronts([]);
      setSelectedConstructionSites([]);
      setReportDate(getTodayLocalDate());
      setExecutedServices([{ service_id: "", quantity: "", unit: "", equipment_used: "", employee_id: "" }]);
      setTerrainCondition("");
      setLocation("");
      setGeneralObservations("");
      setVisits("");
      setOccurrences("");
      setValidationPhotos([]);
      setCustomQuestions([]);
      
    } catch (error: any) {
      toast.error("Erro ao criar RDO: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const exportRDOToPDF = async (shouldConsolidate: boolean = false) => {
    if (!lastCreatedRDOId) {
      toast.error("Nenhum RDO para exportar");
      return;
    }

    try {
      // Buscar dados do RDO
      const { data: rdoData, error: rdoError } = await supabase
        .from('daily_reports')
        .select(`
          *,
          project:projects(name),
          service_front:service_fronts(name),
          construction_site:construction_sites(name, address)
        `)
        .eq('id', lastCreatedRDOId)
        .single();

      if (rdoError) throw rdoError;
      
      if (!rdoData) {
        toast.error("RDO não encontrado");
        return;
      }

      // Buscar serviços executados
      const { data: services, error: servicesError } = await supabase
        .from('executed_services')
        .select(`
          *,
          service:services_catalog(name)
        `)
        .eq('daily_report_id', lastCreatedRDOId);

      if (servicesError) throw servicesError;

      // Buscar fotos
      const { data: photos } = await supabase
        .from('rdo_validation_photos')
        .select('*')
        .eq('daily_report_id', lastCreatedRDOId);

      // Consolidar serviços se solicitado
      let processedServices = services || [];
      if (shouldConsolidate && services && services.length > 0) {
        const serviceMap = new Map<string, any>();
        
        services.forEach((service: any) => {
          const serviceName = service.service?.name || 'N/A';
          const key = `${serviceName}_${service.unit}`;
          
          if (serviceMap.has(key)) {
            const existing = serviceMap.get(key);
            existing.quantity = (parseFloat(existing.quantity) || 0) + (parseFloat(service.quantity) || 0);
            // Concatenar equipamentos
            if (service.equipment_used) {
              const existingEquip = existing.equipment_used?.equipment || '';
              const newEquip = service.equipment_used?.equipment || '';
              if (newEquip && !existingEquip.includes(newEquip)) {
                existing.equipment_used = { equipment: existingEquip ? `${existingEquip}, ${newEquip}` : newEquip };
              }
            }
          } else {
            serviceMap.set(key, { ...service, quantity: parseFloat(service.quantity) || 0 });
          }
        });
        
        processedServices = Array.from(serviceMap.values());
      }

      // Importar jsPDF dinamicamente
      const jsPDFModule = await import('jspdf');
      await import('jspdf-autotable');
      const jsPDF = jsPDFModule.default;
      const doc = new jsPDF();
      
      let yPos = 20;
      
      // Título
      doc.setFontSize(18);
      doc.text('Relatório Diário de Obra (RDO)', 20, yPos);
      yPos += 15;
      
      // Informações do projeto
      doc.setFontSize(12);
      doc.text(`Projeto: ${rdoData.project?.name || 'N/A'}`, 20, yPos);
      yPos += 8;
      doc.text(`Frente de Serviço: ${rdoData.service_front?.name || 'N/A'}`, 20, yPos);
      yPos += 8;
      doc.text(`Local: ${rdoData.construction_site?.name || 'N/A'}`, 20, yPos);
      yPos += 8;
      
      // Formatar data corretamente para evitar problemas de fuso horário
      const reportDate = new Date(rdoData.report_date + 'T12:00:00');
      const formattedDate = reportDate.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
      doc.text(`Data do Relatório: ${formattedDate}`, 20, yPos);
      yPos += 8;

      // Dados climáticos
      if (rdoData.temperature || rdoData.humidity || rdoData.wind_speed) {
        yPos += 5;
        doc.setFontSize(14);
        doc.text('Dados Climáticos:', 20, yPos);
        yPos += 8;
        doc.setFontSize(11);
        if (rdoData.temperature) {
          doc.text(`Temperatura: ${rdoData.temperature}°C`, 25, yPos);
          yPos += 6;
        }
        if (rdoData.humidity) {
          doc.text(`Umidade: ${rdoData.humidity}%`, 25, yPos);
          yPos += 6;
        }
        if (rdoData.wind_speed) {
          doc.text(`Vento: ${rdoData.wind_speed} km/h`, 25, yPos);
          yPos += 6;
        }
        if (rdoData.will_rain !== null) {
          doc.text(`Previsão de Chuva: ${rdoData.will_rain ? 'Sim' : 'Não'}`, 25, yPos);
          yPos += 6;
        }
        if (rdoData.weather_description) {
          doc.text(`Condição: ${rdoData.weather_description}`, 25, yPos);
          yPos += 6;
        }
      }

      yPos += 5;
      
      // Serviços executados
      if (processedServices && processedServices.length > 0) {
        doc.setFontSize(14);
        doc.text(shouldConsolidate ? 'Serviços Executados (Consolidados):' : 'Serviços Executados:', 20, yPos);
        yPos += 10;
        
        doc.setFontSize(11);
        processedServices.forEach((service: any, index: number) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(`${index + 1}. ${service.service?.name || 'N/A'}`, 25, yPos);
          yPos += 6;
          doc.text(`   Quantidade: ${service.quantity} ${service.unit}`, 25, yPos);
          yPos += 6;
          if (service.equipment_used) {
            const equipmentText = typeof service.equipment_used === 'object' 
              ? (service.equipment_used.equipment || JSON.stringify(service.equipment_used))
              : service.equipment_used;
            doc.text(`   Equipamentos: ${equipmentText}`, 25, yPos);
            yPos += 6;
          }
          yPos += 4;
        });
      } else {
        doc.setFontSize(11);
        doc.text('Nenhum serviço executado registrado', 20, yPos);
        yPos += 10;
      }
      
      // Campos opcionais
      if (rdoData.terrain_condition || terrainCondition) {
        yPos += 5;
        doc.setFontSize(12);
        doc.text(`Condição do Terreno: ${rdoData.terrain_condition || terrainCondition}`, 20, yPos);
        yPos += 8;
      }
      
      if (rdoData.gps_location || location) {
        doc.text(`Localização GPS: ${rdoData.gps_location || location}`, 20, yPos);
        yPos += 8;
      }
      
      if (rdoData.visits || visits) {
        yPos += 5;
        doc.setFontSize(12);
        doc.text('Visitas Recebidas:', 20, yPos);
        yPos += 8;
        doc.setFontSize(11);
        const visitLines = doc.splitTextToSize(rdoData.visits || visits, 170);
        visitLines.forEach((line: string) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, 20, yPos);
          yPos += 6;
        });
      }

      if (rdoData.occurrences_summary || occurrences) {
        yPos += 5;
        doc.setFontSize(12);
        doc.text('Ocorrências:', 20, yPos);
        yPos += 8;
        doc.setFontSize(11);
        const occurrenceLines = doc.splitTextToSize(rdoData.occurrences_summary || occurrences, 170);
        occurrenceLines.forEach((line: string) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, 20, yPos);
          yPos += 6;
        });
      }
      
      if (rdoData.general_observations || generalObservations) {
        yPos += 5;
        doc.setFontSize(12);
        doc.text('Observações Gerais:', 20, yPos);
        yPos += 8;
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(rdoData.general_observations || generalObservations, 170);
        lines.forEach((line: string) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, 20, yPos);
          yPos += 6;
        });
      }

      // Fotos (com URLs assinadas)
      if (photos && photos.length > 0) {
        doc.addPage();
        yPos = 20;
        doc.setFontSize(14);
        doc.text('Fotos de Validação:', 20, yPos);
        yPos += 10;
        
        doc.setFontSize(11);
        doc.text(`Total de fotos: ${photos.length}`, 20, yPos);
        yPos += 10;

        for (const photo of photos) {
          try {
            const rawPath = photo.photo_url || "";
            const path = rawPath.includes('rdo-photos/')
              ? rawPath.split('rdo-photos/')[1]
              : rawPath;

            const { data: signedData } = await supabase.storage
              .from('rdo-photos')
              .createSignedUrl(path, 60 * 5);

            if (signedData?.signedUrl) {
              // Load and add image to PDF
              const img = document.createElement('img') as HTMLImageElement;
              img.crossOrigin = 'anonymous';
              
              await new Promise<void>((resolve, reject) => {
                img.onload = () => {
                  if (yPos > 200) {
                    doc.addPage();
                    yPos = 20;
                  }
                  
                  const maxWidth = 170;
                  const maxHeight = 100;
                  let width = img.width;
                  let height = img.height;
                  
                  if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                  }
                  if (height > maxHeight) {
                    width = (maxHeight / height) * width;
                    height = maxHeight;
                  }

                  doc.addImage(img, 'JPEG', 20, yPos, width, height);
                  yPos += height + 10;
                  resolve();
                };
                img.onerror = () => {
                  console.error('Erro ao carregar imagem');
                  resolve();
                };
                img.src = signedData.signedUrl;
              });
            }
          } catch (err) {
            console.error('Erro ao processar foto:', err);
          }
        }
      }
      
      // Salvar PDF com nome formatado
      const projectName = rdoData.project?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'RDO';
      const dateStr = rdoData.report_date.replace(/\-/g, '');
      doc.save(`RDO_${projectName}_${dateStr}.pdf`);
      toast.success("PDF gerado com sucesso!");
      setShowExportDialog(false);
      
    } catch (error: any) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF: " + (error.message || "Erro desconhecido"));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <Building2 className="w-6 h-6 mr-2" />
              <span className="font-bold">ConstruData</span>
            </Button>
            <h1 className="text-xl font-semibold">Relatório Diário de Obra (RDO)</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          <div className="lg:col-span-2">
        <Tabs defaultValue="create">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="create">
              <FileText className="w-4 h-4 mr-2" />
              Criar RDO
            </TabsTrigger>
            <TabsTrigger value="history">
              <BarChart3 className="w-4 h-4 mr-2" />
              Histórico e Gráficos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>Novo RDO</CardTitle>
                <CardDescription>Preencha as informações do relatório diário</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Quadros Selecionáveis Numerados */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Informações do RDO</h3>
                
                {/* Quadro 0: Projeto */}
                <Card className="border-2 border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Projeto *</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SearchableSelect
                      options={projects.map(project => ({
                        value: project.id,
                        label: project.name
                      }))}
                      value={selectedProject}
                      onValueChange={setSelectedProject}
                      placeholder="Selecione o projeto"
                      searchPlaceholder="Pesquisar projeto..."
                      emptyMessage="Nenhum projeto encontrado."
                    />
                  </CardContent>
                </Card>

                {/* Quadro 1: Frentes de Serviço */}
                <Card className="border-2 border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">1. Frentes de Serviço *</CardTitle>
                    <CardDescription className="text-xs">Selecione uma ou mais frentes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Pesquisar frentes..."
                        value={serviceFrontSearch}
                        onChange={(e) => setServiceFrontSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-2">
                      {serviceFronts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma frente disponível</p>
                      ) : (
                        serviceFronts
                          .filter(front => front.name.toLowerCase().includes(serviceFrontSearch.toLowerCase()))
                          .map(front => (
                          <label key={front.id} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedServiceFronts.includes(front.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedServiceFronts([...selectedServiceFronts, front.id]);
                                } else {
                                  setSelectedServiceFronts(selectedServiceFronts.filter(id => id !== front.id));
                                }
                              }}
                              disabled={!selectedProject}
                              className="rounded"
                            />
                            <span className="text-sm">{front.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowServiceFrontDialog(true)}
                      disabled={!selectedProject}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar Nova Frente
                    </Button>
                  </CardContent>
                </Card>

                {/* Quadro 2: Locais da Obra */}
                <Card className="border-2 border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">2. Locais da Obra *</CardTitle>
                    <CardDescription className="text-xs">Selecione um ou mais locais</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Pesquisar locais..."
                        value={constructionSiteSearch}
                        onChange={(e) => setConstructionSiteSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-2">
                      {constructionSites.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum local disponível</p>
                      ) : (
                        constructionSites
                          .filter(site => site.name.toLowerCase().includes(constructionSiteSearch.toLowerCase()))
                          .map(site => (
                          <label key={site.id} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedConstructionSites.includes(site.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedConstructionSites([...selectedConstructionSites, site.id]);
                                } else {
                                  setSelectedConstructionSites(selectedConstructionSites.filter(id => id !== site.id));
                                }
                              }}
                              disabled={!selectedProject}
                              className="rounded"
                            />
                            <span className="text-sm">{site.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowConstructionSiteDialog(true)}
                      disabled={!selectedProject}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar Novo Local
                    </Button>
                  </CardContent>
                </Card>

                {/* Quadro 3: Serviços Executados */}
                <Card className="border-2 border-primary/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">3. Serviços Executados *</CardTitle>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowServiceDialog(true)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Adicionar Serviço ao Catálogo
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {executedServices.map((service, index) => (
                      <Card key={index} className="p-4 bg-muted/30">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium">Serviço {index + 1}</h4>
                            {executedServices.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeExecutedService(index)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Serviço</Label>
                              <SearchableSelect
                                options={servicesCatalog.map(s => ({
                                  value: s.id,
                                  label: s.name,
                                  sublabel: s.unit
                                }))}
                                value={service.service_id}
                                onValueChange={(value) => updateExecutedService(index, 'service_id', value)}
                                placeholder="Selecione o serviço"
                                searchPlaceholder="Pesquisar serviço..."
                                emptyMessage="Nenhum serviço encontrado."
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Quantidade</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={service.quantity}
                                onChange={(e) => updateExecutedService(index, 'quantity', e.target.value)}
                                placeholder="0.00"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Unidade</Label>
                              <Input
                                value={service.unit}
                                onChange={(e) => updateExecutedService(index, 'unit', e.target.value)}
                                placeholder="m², m³, un"
                                readOnly
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Equipamentos Utilizados (opcional)</Label>
                              <Input
                                value={service.equipment_used}
                                onChange={(e) => updateExecutedService(index, 'equipment_used', e.target.value)}
                                placeholder="Betoneira, Vibrador..."
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Funcionário Responsável (opcional)</Label>
                              <SearchableSelect
                                options={employees.map(emp => ({
                                  value: emp.id,
                                  label: emp.name,
                                  sublabel: emp.role || undefined
                                }))}
                                value={service.employee_id || ""}
                                onValueChange={(value) => updateExecutedService(index, 'employee_id', value)}
                                placeholder="Selecione o funcionário"
                                searchPlaceholder="Pesquisar funcionário..."
                                emptyMessage="Nenhum funcionário encontrado."
                              />
                            </div>
                          </div>

                          {service.service_id && service.quantity && checkBelowTarget(service.service_id, parseFloat(service.quantity)) && (
                            <div className="space-y-2 border-t pt-4">
                              <Label className="text-destructive">Justificativa (Produção Abaixo da Meta) *</Label>
                              <Textarea
                                value={service.justification || ""}
                                onChange={(e) => updateExecutedService(index, 'justification', e.target.value)}
                                placeholder="Explique o motivo da produção estar abaixo da meta..."
                                rows={3}
                                className="border-destructive"
                              />
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={addExecutedService}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Outro Serviço
                    </Button>
                  </CardContent>
                </Card>

                {/* Perguntas Customizadas */}
                {customQuestions.map((question, index) => (
                  <Card key={question.id} className="border-2 border-primary/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{index + 4}. {question.question}</CardTitle>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCustomQuestion(question.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {question.type === 'text' && (
                        <Textarea
                          value={question.answer}
                          onChange={(e) => updateCustomQuestion(question.id, e.target.value)}
                          placeholder="Digite sua resposta..."
                          rows={3}
                        />
                      )}
                      {question.type === 'number' && (
                        <Input
                          type="number"
                          value={question.answer}
                          onChange={(e) => updateCustomQuestion(question.id, e.target.value)}
                          placeholder="Digite um número..."
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}

                {/* Botão Nova Pergunta */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewQuestionDialog(true)}
                  className="w-full border-dashed border-2"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Pergunta
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project">Obra *</Label>
                  <SearchableSelect
                    options={projects.map(project => ({
                      value: project.id,
                      label: project.name
                    }))}
                    value={selectedProject}
                    onValueChange={setSelectedProject}
                    placeholder="Selecione a obra"
                    searchPlaceholder="Pesquisar obra..."
                    emptyMessage="Nenhuma obra encontrada."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Data *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    max={getTodayLocalDate()}
                    required
                  />
                </div>
              </div>

              {/* Condição do Terreno */}
              <div className="space-y-2">
                <Label htmlFor="terrainCondition">Condição do Terreno (opcional)</Label>
                <SearchableSelect
                  options={[
                    { value: "seco", label: "Seco" },
                    { value: "umido", label: "Úmido" },
                    { value: "molhado", label: "Molhado" },
                    { value: "lamacento", label: "Lamacento" },
                    { value: "alagado", label: "Alagado" }
                  ]}
                  value={terrainCondition}
                  onValueChange={setTerrainCondition}
                  placeholder="Selecione a condição"
                  searchPlaceholder="Pesquisar condição..."
                  emptyMessage="Nenhuma condição encontrada."
                />
              </div>

              {/* Localização */}
              <div className="space-y-2">
                <Label htmlFor="location">Localização (opcional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Latitude, Longitude"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={handleGetGPS}>
                    <MapPin className="w-4 h-4 mr-2" />
                    Obter GPS
                  </Button>
                </div>
              </div>

              {/* Visitas */}
              <div className="space-y-2">
                <Label htmlFor="visits">Visitas Recebidas (opcional)</Label>
                <Textarea
                  id="visits"
                  value={visits}
                  onChange={(e) => setVisits(e.target.value)}
                  placeholder="Descreva as visitas recebidas na obra (fiscalizações, fornecedores, clientes, etc.)"
                  rows={3}
                />
              </div>

              {/* Ocorrências */}
              <div className="space-y-2">
                <Label htmlFor="occurrences">Ocorrências (opcional)</Label>
                <Textarea
                  id="occurrences"
                  value={occurrences}
                  onChange={(e) => setOccurrences(e.target.value)}
                  placeholder="Registre ocorrências importantes (acidentes, atrasos, problemas, etc.)"
                  rows={3}
                />
              </div>

              {/* Observações Gerais */}
              <div className="space-y-2">
                <Label htmlFor="observations">Observações Gerais (opcional)</Label>
                <Textarea
                  id="observations"
                  value={generalObservations}
                  onChange={(e) => setGeneralObservations(e.target.value)}
                  placeholder="Descreva as atividades realizadas, problemas encontrados, etc."
                  rows={4}
                />
              </div>

              {/* Fotos de Validação */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Fotos de Validação (opcional)
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Tire fotos do local para validar a localização
                </p>
                <div className="space-y-3">
                  {validationPhotos.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {validationPhotos.map((photo, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={URL.createObjectURL(photo)}
                            alt={`Foto ${index + 1}`}
                            className="w-full h-24 object-cover rounded-md"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                            onClick={() => removePhoto(index)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      className="hidden"
                      id="photo-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => document.getElementById('photo-upload')?.click()}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Fotos
                    </Button>
                  </label>
                </div>
              </div>

                  <div className="flex gap-3">
                    <Button type="submit" className="flex-1" disabled={isLoading}>
                      {isLoading ? "Salvando..." : "Criar RDO"}
                    </Button>
                    {lastCreatedRDOId && (
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => setShowExportDialog(true)}
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Exportar PDF
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            {selectedProject ? (
              <RDOHistoryView projectId={selectedProject} />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BarChart3 className="w-16 h-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Selecione um projeto para visualizar o histórico de RDOs
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
        </div>

        {/* Sidebar Direita */}
        <div className="lg:col-span-1 space-y-6">
          {/* Dados Climáticos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                Dados Climáticos
              </CardTitle>
              <CardDescription>
                {isLoadingWeather ? "Carregando..." : weatherData ? "Dados atualizados" : "Aguardando localização"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingWeather ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Cloud className="w-16 h-16 text-muted-foreground mb-4 animate-pulse" />
                  <p className="text-sm text-muted-foreground">Obtendo dados climáticos...</p>
                </div>
              ) : weatherData ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Temperatura</span>
                    <span className="text-lg font-semibold">{weatherData.temperature}°C</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Umidade</span>
                    <span className="text-lg font-semibold">{weatherData.humidity}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Vento</span>
                    <span className="text-lg font-semibold">{weatherData.windSpeed} km/h</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Previsão de Chuva</span>
                    <span className={`text-lg font-semibold ${weatherData.willRain ? 'text-destructive' : 'text-green-600'}`}>
                      {weatherData.willRain ? 'Sim' : 'Não'}
                    </span>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-sm text-center text-muted-foreground capitalize">
                      {weatherData.description}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <Cloud className="w-16 h-16 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground text-center">
                    Clique em "Obter GPS" para ver os dados climáticos
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dicas */}
          <Card>
            <CardHeader>
              <CardTitle>Dicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                <p className="text-sm text-muted-foreground">
                  Registre o RDO diariamente para melhor controle
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                <p className="text-sm text-muted-foreground">
                  As fotos ajudam na validação da localização
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                <p className="text-sm text-muted-foreground">
                  Dados climáticos são salvos automaticamente
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                <p className="text-sm text-muted-foreground">
                  Descreva detalhadamente as atividades realizadas
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </main>

      <AddServiceFrontDialog
        open={showServiceFrontDialog}
        onOpenChange={setShowServiceFrontDialog}
        projectId={selectedProject}
        onSuccess={async () => {
          await loadServiceFronts(selectedProject);
          setShowServiceFrontDialog(false);
          toast.success("Frente de serviço adicionada e disponível na lista!");
        }}
      />

      <AddConstructionSiteDialog
        open={showConstructionSiteDialog}
        onOpenChange={setShowConstructionSiteDialog}
        projectId={selectedProject}
        onSuccess={async () => {
          await loadConstructionSites(selectedProject);
          setShowConstructionSiteDialog(false);
          toast.success("Local de obra adicionado e disponível na lista!");
        }}
      />

      <AddServiceDialog
        open={showServiceDialog}
        onOpenChange={setShowServiceDialog}
        onSuccess={async () => {
          await loadServicesCatalog();
          setShowServiceDialog(false);
          toast.success("Serviço adicionado ao catálogo e disponível na lista!");
        }}
      />

      {/* Dialog Nova Pergunta */}
      <Dialog open={showNewQuestionDialog} onOpenChange={setShowNewQuestionDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Adicionar Nova Pergunta</DialogTitle>
            <DialogDescription>Crie uma pergunta customizada para o RDO</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newQuestion">Pergunta</Label>
              <Input
                id="newQuestion"
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                placeholder="Digite a pergunta..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="questionType">Tipo de Resposta</Label>
              <Select value={newQuestionType} onValueChange={(value: any) => setNewQuestionType(value)}>
                <SelectTrigger id="questionType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowNewQuestionDialog(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={addCustomQuestion}>
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Exportar PDF */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Exportar RDO para PDF</DialogTitle>
            <DialogDescription>Configure as opções de exportação</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="consolidate" 
                checked={consolidateServices}
                onCheckedChange={(checked) => setConsolidateServices(checked === true)}
              />
              <label 
                htmlFor="consolidate" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Consolidar serviços iguais
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Ao ativar esta opção, serviços com o mesmo nome e unidade serão somados e exibidos como um único item no PDF.
            </p>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowExportDialog(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => exportRDOToPDF(consolidateServices)}>
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RDONew;