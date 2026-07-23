import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastKind = "info" | "error" | "success";

interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastApi {
  info(text: string): void;
  error(text: string): void;
  success(text: string): void;
}

const Ctx = createContext<ToastApi | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (kind: ToastKind, text: string) => {
      const id = ++seq;
      setToasts((t) => [...t, { id, kind, text }]);
      window.setTimeout(() => remove(id), kind === "error" ? 6500 : 3500);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      info: (t) => push("info", t),
      error: (t) => push("error", t),
      success: (t) => push("success", t),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} onClick={() => remove(t.id)}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast musi być użyte wewnątrz ToastProvider");
  return ctx;
}
