"use client";

import { useEffect, useState } from "react";

import { Language } from "@/lib/types";

export const UI_LANG_STORAGE_KEY = "oku_ui_lang";
const UI_LANG_EVENT = "oku-ui-language-changed";

export function tr(language: Language, ru: string, kz: string): string {
  return language === "KZ" ? kz : ru;
}

export function getUiLanguage(): Language {
  if (typeof window === "undefined") return "RU";

  const fromStorage = localStorage.getItem(UI_LANG_STORAGE_KEY);
  if (fromStorage === "RU" || fromStorage === "KZ") {
    return fromStorage;
  }

  const fromDataset = document.documentElement.dataset.uiLanguage;
  if (fromDataset === "RU" || fromDataset === "KZ") {
    return fromDataset;
  }

  return "RU";
}

export function setUiLanguage(language: Language): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(UI_LANG_STORAGE_KEY, language);
  document.documentElement.dataset.uiLanguage = language;
  document.documentElement.lang = language === "KZ" ? "kk" : "ru";
  window.dispatchEvent(new CustomEvent<Language>(UI_LANG_EVENT, { detail: language }));
}

export function useUiLanguage(): Language {
  const [language, setLanguage] = useState<Language>("RU");

  useEffect(() => {
    setLanguage(getUiLanguage());

    const onStorage = (event: StorageEvent) => {
      if (event.key !== UI_LANG_STORAGE_KEY) return;
      setLanguage(getUiLanguage());
    };

    const onLanguageChange = () => {
      setLanguage(getUiLanguage());
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(UI_LANG_EVENT, onLanguageChange as EventListener);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(UI_LANG_EVENT, onLanguageChange as EventListener);
    };
  }, []);

  return language;
}

export function uiLocale(language: Language): string {
  return language === "KZ" ? "kk-KZ" : "ru-RU";
}
