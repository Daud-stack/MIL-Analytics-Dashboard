'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './button';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  name?: string;
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
    console.error(`ErrorBoundary[${this.props.name || 'Component'}] caught an error:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center p-8 m-4 rounded-xl border border-rose-100 bg-rose-50/50">
          <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-600 mb-6 text-center max-w-md">
            The {this.props.name ? `"${this.props.name}" ` : ''}chart or component experienced an error rendering the current dataset. The data might be corrupted.
          </p>
          <Button 
            variant="outline" 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </Button>
          {this.state.error && process.env.NODE_ENV === 'development' && (
            <pre className="mt-6 p-4 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-auto max-w-full text-left">
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
