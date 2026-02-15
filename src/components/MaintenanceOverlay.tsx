import { Shield, MessageCircle } from "lucide-react";

const MaintenanceOverlay = () => {
  // Para remover o overlay, basta mudar esta variável para false ou deletar este componente
  const isMaintenanceMode = false;

  if (!isMaintenanceMode) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="max-w-lg mx-4 text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-orange-500/20 p-6">
            <Shield className="h-16 w-16 text-orange-500 animate-pulse" />
          </div>
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-4">
          Acesso Suspenso por Manutenção
        </h1>
        
        <p className="text-lg text-gray-300 mb-6 leading-relaxed">
          Estamos otimizando nosso sistema de segurança da plataforma. 
          Logo mais, voltaremos.
        </p>
        
        <div className="bg-white/10 rounded-lg p-6 mb-6">
          <p className="text-gray-200 mb-4">
            Entre em contato no nosso WhatsApp para qualquer dúvida.
          </p>
          <div className="flex justify-center">
            <a 
              href="https://wa.me/5500000000000" 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              <MessageCircle className="h-5 w-5" />
              WhatsApp
            </a>
          </div>
        </div>
        
        <p className="text-sm text-gray-500">
          Agradecemos a compreensão.
        </p>
      </div>
    </div>
  );
};

export default MaintenanceOverlay;
