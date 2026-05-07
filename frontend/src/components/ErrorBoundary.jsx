import React from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "./ui";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#03050C] px-4 text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 -z-10 animate-pulse rounded-full bg-red-500/20 blur-[60px]" />
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-red-500/20 bg-red-500/10 text-red-400">
              <TriangleAlert className="h-10 w-10" />
            </div>
          </div>

          <h1 className="font-display text-2xl font-bold text-white md:text-3xl">
            Something went wrong
          </h1>
          <p className="mt-4 max-w-md text-slate-400">
            A runtime error occurred in the workspace. We've logged the incident and you can try to recover by refreshing.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button
              onClick={() => window.location.reload()}
              className="group flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4 transition-transform group-hover:rotate-180" />
              Refresh application
            </Button>
            <Button
              variant="secondary"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </Button>
          </div>

          {process.env.NODE_ENV !== "production" && this.state.error && (
            <div className="mt-12 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Error Details</p>
              <pre className="mt-3 overflow-auto text-xs text-red-300">
                {this.state.error.stack || this.state.error.message}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
