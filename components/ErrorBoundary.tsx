
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center font-sans">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6 text-red-500 shadow-sm">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="32" 
              height="32" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Algo salió mal</h1>
          <p className="text-gray-600 mb-8 max-w-md">
            Ha ocurrido un error inesperado. Hemos registrado el problema.
          </p>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm text-left w-full max-w-lg overflow-x-auto mb-8">
             <code className="text-xs font-mono text-red-600 block whitespace-pre-wrap break-words">
               {this.state.error?.message || "Error desconocido"}
             </code>
          </div>

          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-8 py-3 bg-gray-900 text-white rounded-full font-bold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl transform active:scale-95"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            Recargar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
