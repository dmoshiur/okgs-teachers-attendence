"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
  leaving?: boolean;
};

type ToastContextValue = {
  toast: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info
} as const;

const ICON_COLORS = {
  success: "text-emerald-600",
  error: "text-rose-600",
  info: "text-sky-600"
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      setToasts((current) =>
        current.map((item) => (item.id === id ? { ...item, leaving: true } : item))
      );
      timers.current.set(
        id,
        setTimeout(() => remove(id), 180)
      );
    },
    [remove]
  );

  const toast = useCallback(
    (message: string, kind: ToastKind = "success") => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current.slice(-3), { id, kind, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), kind === "error" ? 6000 : 4000)
      );
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2"
      >
        {toasts.map((item) => {
          const Icon = ICONS[item.kind];
          return (
            <div
              key={item.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-white/95 px-4 py-3 shadow-lg backdrop-blur transition-all duration-200 ${
                item.leaving ? "translate-x-3 opacity-0" : "translate-x-0 opacity-100"
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 ${ICON_COLORS[item.kind]}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <p className="flex-1 text-sm leading-5 text-slate-800">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
