import React, { type ErrorInfo, type ReactNode, Component } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import XiaoMeiAvatar from '../mascot/XiaoMeiAvatar';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  title?: string;
  description?: string;
  onRetry?: () => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableReport?: boolean;
  maxReportsPerSession?: number;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  private reportCount = 0;
  private maxReports: number;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false };
    this.maxReports = props.maxReportsPerSession ?? 5;
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, showDetails: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    console.error('[ErrorBoundary] caught error:', error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    if (this.props.enableReport && this.reportCount < this.maxReports) {
      this.reportError(error, errorInfo);
    }
  }

  private reportError(error: Error, errorInfo: ErrorInfo) {
    this.reportCount++;

    const errorReport = {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      componentStack: errorInfo.componentStack,
    };

    console.log('[ErrorBoundary] Error report:', errorReport);

    try {
      const existingReports = JSON.parse(localStorage.getItem('error_reports') || '[]');
      existingReports.push(errorReport);
      if (existingReports.length > 20) {
        existingReports.shift();
      }
      localStorage.setItem('error_reports', JSON.stringify(existingReports));
    } catch (e) {
      console.warn('[ErrorBoundary] Failed to save error report:', e);
    }
  }

  handleRetry = () => {
    this.reportCount = 0;

    if (this.props.onRetry) {
      this.props.onRetry();
      return;
    }
    window.location.reload();
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const title = this.props.title ?? '出错了';
      const description =
        this.props.description ?? this.state.error?.message ?? '应用遇到了一个意外错误，请重试';

      return (
        <div className="flex h-full flex-col items-center justify-center bg-[linear-gradient(180deg,#fbfcff_0%,#f6f7fb_100%)] p-8">
          <div className="w-16 h-16 rounded-full bg-[var(--danger-soft)] flex items-center justify-center mb-4">
            <XiaoMeiAvatar mood="sad" size="w-12 h-12" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
          <p className="text-gray-500 text-sm text-center mb-4 max-w-xs">{description}</p>

          {this.state.error?.stack && (
            <button onClick={this.toggleDetails} className="text-xs text-gray-400 underline mb-4">
              {this.state.showDetails ? '隐藏详情' : '查看详情'}
            </button>
          )}

          {this.state.showDetails && this.state.error?.stack && (
            <div className="w-full max-w-lg mb-4 p-3 bg-gray-100 rounded-lg overflow-auto max-h-32">
              <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all">
                {this.state.error.stack}
              </pre>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              重试
            </button>

            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors active:scale-95"
            >
              返回
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
