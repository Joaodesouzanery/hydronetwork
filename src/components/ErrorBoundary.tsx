import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.moduleName ? ` — ${this.props.moduleName}` : ""}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="bg-red-100 dark:bg-red-900/20 p-4 mb-4">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold font-mono mb-1">
            Erro no módulo{this.props.moduleName ? ` "${this.props.moduleName}"` : ""}
          </h3>
          <p className="text-sm text-muted-foreground font-mono mb-4 max-w-md">
            Ocorreu um erro inesperado. Tente recarregar a página ou navegar para outro módulo.
          </p>
          <details className="text-xs text-left bg-muted/50 p-3 max-w-lg w-full border border-border font-mono">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Detalhes do erro
            </summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap text-red-600 dark:text-red-400">
              {this.state.error?.message}
            </pre>
          </details>
          <button
            className="mt-4 px-4 py-2 text-sm font-mono bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Tentar Novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
