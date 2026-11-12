import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  durationMs: number;
}

interface ToastState {
  toasts: ToastItem[];
  showToast: (message: string, type?: ToastType, durationMs?: number) => string;
  dismissToast: (id: string) => void;
}

const MAX_VISIBLE_TOASTS = 4;
const DEFAULT_DURATION_MS = 4000;
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearToastTimer(id: string) {
  const existing = toastTimers.get(id);
  if (existing !== undefined) {
    clearTimeout(existing);
    toastTimers.delete(id);
  }
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  showToast: (message, type = "info", durationMs = DEFAULT_DURATION_MS) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    set((state) => {
      const next = [...state.toasts, { id, message, type, durationMs }];
      if (next.length > MAX_VISIBLE_TOASTS) {
        const evicted = next.slice(0, next.length - MAX_VISIBLE_TOASTS);
        evicted.forEach((t) => clearToastTimer(t.id));
        return { toasts: next.slice(-MAX_VISIBLE_TOASTS) };
      }
      return { toasts: next };
    });

    if (durationMs > 0) {
      const timer = setTimeout(() => {
        clearToastTimer(id);
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, durationMs);
      toastTimers.set(id, timer);
    }

    return id;
  },

  dismissToast: (id) => {
    clearToastTimer(id);
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

export const showToast = (
  message: string,
  type: ToastType = "info",
  durationMs?: number
) => useToastStore.getState().showToast(message, type, durationMs);
