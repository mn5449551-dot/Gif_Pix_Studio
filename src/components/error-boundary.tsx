"use client";

import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="cute-panel p-6 text-center">
          <p className="pixel-title text-lg text-danger">出错了</p>
          <p className="mt-4 text-lg text-text-muted break-words">{this.state.error.message}</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              className="arcade-button secondary"
              onClick={() => window.location.reload()}
            >
              刷新页面
            </button>
            <button
              className="arcade-button"
              onClick={() => this.setState({ error: null })}
            >
              重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
