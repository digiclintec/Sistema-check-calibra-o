import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturou um erro:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900 text-white">
          <div className="max-w-md w-full bg-slate-800 p-6 rounded-2xl border border-red-500/40 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white">Ops, algo inesperado ocorreu</h2>
            <p className="text-xs text-slate-300">
              {this.state.error?.message || 'Erro ao carregar este componente.'}
            </p>
            <button
              onClick={this.handleReload}
              className="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 mx-auto transition shadow-lg"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Recarregar Tela</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
