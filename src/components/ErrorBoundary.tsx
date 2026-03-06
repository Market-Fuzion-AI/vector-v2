import React from 'react';

interface Props {
  children?: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white p-8 text-center">
          <p className="text-2xl mb-2">⚠️</p>
          <p className="text-base font-semibold text-gray-900 mb-1">Something went wrong.</p>
          <p className="text-sm text-gray-500 mb-6">Refresh to recover.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 bg-[#2F5BFF] text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors"
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
