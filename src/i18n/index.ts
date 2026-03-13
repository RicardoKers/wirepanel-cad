import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources, supportedLanguages, type SupportedLanguage } from "./resources";

const storageKey = "basic2dcad.language";

function normalizeLanguage(input: string | null | undefined): SupportedLanguage {
  if (!input) return "en";
  const match = supportedLanguages.find((language) => language.toLowerCase() === input.toLowerCase());
  if (match) return match;
  if (input.toLowerCase().startsWith("pt")) return "pt-BR";
  return "en";
}

const initialLanguage = normalizeLanguage(
  typeof window !== "undefined" ? localStorage.getItem(storageKey) ?? navigator.language : "en"
);

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false
  }
});

i18n.on("languageChanged", (language) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey, normalizeLanguage(language));
});

export default i18n;
