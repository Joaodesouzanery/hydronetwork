import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-mono">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold font-mono text-[#FF6B2C]">404</h1>
        <p className="mb-6 text-lg text-muted-foreground font-mono">Página não encontrada</p>
        <a href="/" className="text-sm font-mono border border-border px-6 py-3 hover:bg-[#FF6B2C]/5 transition-colors">
          VOLTAR AO INÍCIO
        </a>
      </div>
    </div>
  );
};

export default NotFound;
