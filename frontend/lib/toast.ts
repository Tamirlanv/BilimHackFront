export type AppToastType = "success" | "error" | "info";

export interface AppToast {
  id: string;
  message: string;
  type: AppToastType;
  durationMs: number;
}

type ToastListener = (toast: AppToast) => void;

const listeners = new Set<ToastListener>();

function emit(toast: AppToast): void {
  listeners.forEach((listener) => listener(toast));
}

export function pushToast(input: {
  message: string;
  type?: AppToastType;
  durationMs?: number;
}): void {
  const message = input.message.trim();
  if (!message) return;
  emit({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    type: input.type ?? "info",
    durationMs: input.durationMs ?? 5000,
  });
}

export function subscribeToToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const toast = {
  info(message: string, durationMs?: number) {
    pushToast({ message, type: "info", durationMs });
  },
  success(message: string, durationMs?: number) {
    pushToast({ message, type: "success", durationMs });
  },
  error(message: string, durationMs?: number) {
    pushToast({ message, type: "error", durationMs });
  },
};

