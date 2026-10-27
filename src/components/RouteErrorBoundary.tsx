import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  routeName: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render crashes on the @-routes and shows the error instead of a
 * blank white page, so failures are diagnosable.
 */
export class RouteErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(`[RouteErrorBoundary:${this.props.routeName}]`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="news-grid">
          <div className="space-not-found">
            <div className="space-not-found-emoji">🔧</div>
            <h2>Something went wrong on this page</h2>
            <p style={{ wordBreak: 'break-word' }}>
              {this.state.error.message || 'Unknown error'}
            </p>
            <button
              type="button"
              className="sign-in-button primary-button"
              onClick={() => (window.location.href = '/')}
            >
              Back to Littlables
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

export default RouteErrorBoundary;
