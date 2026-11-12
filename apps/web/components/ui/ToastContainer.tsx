"use client";

import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { ToastType, useToastStore } from "@/store/useToastStore";

const TOAST_STYLES: Record<
  ToastType,
  { container: string; icon: React.ReactNode }
> = {
  success: {
    container: "bg-emerald-50/95 border-emerald-200 text-emerald-900",
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />,
  },
  error: {
    container: "bg-rose-50/95 border-rose-200 text-rose-900",
    icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />,
  },
  warning: {
    container: "bg-amber-50/95 border-amber-200 text-amber-900",
    icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
  },
  info: {
    container: "bg-blue-50/95 border-blue-200 text-blue-900",
    icon: <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />,
  },
};

export default function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 w-[calc(100vw-2rem)] sm:max-w-md pointer-events-none"
    >
      {toasts.map((toast) => {
        const style = TOAST_STYLES[toast.type];
        return (
          <div
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all ${style.container}`}
          >
            {style.icon}
            <p className="text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-line flex-1 break-words">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="p-0.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 transition shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
