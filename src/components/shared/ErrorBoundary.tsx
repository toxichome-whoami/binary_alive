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
    error: null,
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
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white p-6" role="alert">
          <h2 className="text-2xl font-bold mb-4 text-[#ff4b4b]">Something went wrong</h2>
          <p className="text-[#8c8c8c] mb-6 max-w-md text-center">
            An unexpected error occurred in the application. Please try refreshing the page.
          </p>
          <div className="bg-[#1a1a1a] p-4 rounded border border-[#262626] overflow-x-auto max-w-full mb-6">
            <pre className="text-[12px] text-[#ff4b4b] font-mono">
              {this.state.error?.message}
            </pre>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white text-black font-semibold rounded hover:bg-gray-200 transition-colors"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
