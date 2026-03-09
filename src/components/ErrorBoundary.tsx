import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import i18n from '../i18n/i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[PrepTrack] Unbehandelter Fehler:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const t = i18n.t.bind(i18n);
      return (
        <div className="flex min-h-screen items-center justify-center bg-primary-900 p-6">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-primary-800 p-6 text-center">
            <AlertTriangle size={48} className="mx-auto mb-4 text-red-400" />
            <h2 className="mb-2 text-xl font-bold text-gray-100">{t('error.title')}</h2>
            <p className="mb-4 text-sm text-gray-400">
              {t('error.description')}
            </p>
            {this.state.error && (
              <pre className="mb-4 overflow-auto rounded-lg bg-primary-900 p-3 text-left text-xs text-red-300">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-primary-600 px-4 py-2.5 text-sm text-gray-300 hover:bg-primary-700"
              >
                {t('error.retry')}
              </button>
              <button
                onClick={this.handleReload}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-500"
              >
                <RefreshCw size={16} />
                {t('error.reload')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
