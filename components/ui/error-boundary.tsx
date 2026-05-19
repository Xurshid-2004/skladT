"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // Here we can log to Firestore if needed
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="w-20 h-20 bg-danger/10 text-danger rounded-3xl flex items-center justify-center mb-6">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Xatolik yuz berdi</h2>
          <p className="text-muted-foreground mb-8 max-w-md">
            {this.state.error?.message || "Tizimda kutilmagan xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring."}
          </p>
          <button
            className="px-6 py-3 bg-primary text-white rounded-xl font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
          >
            <RefreshCcw className="w-5 h-5" />
            Qaytadan urinish
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
