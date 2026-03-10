"use client";

import { useEffect, useRef, useState } from "react";

import { AppToast, subscribeToToasts } from "@/lib/toast";
import styles from "@/components/ToastViewport.module.css";

export default function ToastViewport() {
  const [toasts, setToasts] = useState<AppToast[]>([]);
  const timeoutsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const unsubscribe = subscribeToToasts((incoming) => {
      setToasts((prev) => [...prev, incoming]);
      const timeoutId = window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== incoming.id));
        delete timeoutsRef.current[incoming.id];
      }, incoming.durationMs);
      timeoutsRef.current[incoming.id] = timeoutId;
    });

    return () => {
      unsubscribe();
      Object.values(timeoutsRef.current).forEach((id) => {
        window.clearTimeout(id);
      });
      timeoutsRef.current = {};
    };
  }, []);

  const closeToast = (id: string) => {
    const timeoutId = timeoutsRef.current[id];
    if (typeof timeoutId === "number") {
      window.clearTimeout(timeoutId);
      delete timeoutsRef.current[id];
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div aria-live="polite" className={styles.viewport}>
      {toasts.map((item) => (
        <div
          key={item.id}
          className={`${styles.toast} ${
            item.type === "success" ? styles.toastSuccess : item.type === "error" ? styles.toastError : styles.toastInfo
          }`}
          role="status"
        >
          <p className={styles.message}>{item.message}</p>
          <button aria-label="Close" className={styles.close} onClick={() => closeToast(item.id)} type="button">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

