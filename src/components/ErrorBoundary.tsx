import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Unhandled UI error:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-dvh bg-[#FBFBF9] dark:bg-[#121417] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 text-center space-y-4">
          <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100">
            Tampilan gagal dimuat
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Data kamu tetap aman. Muat ulang halaman untuk melanjutkan.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-[44px] px-5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-semibold"
          >
            Muat ulang
          </button>
        </div>
      </div>
    );
  }
}
