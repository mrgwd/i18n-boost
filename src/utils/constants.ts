import { DocumentSelector } from "vscode";

/**
 * Common locale display names
 */
export const LOCALE_DISPLAY_NAMES: Record<string, string> = {
  ar: "Arabic",
  en: "English",
  de: "German",
  es: "Spanish",
  fr: "French",
  hi: "Hindi",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  pt: "Portuguese",
  ru: "Russian",
  zh: "Chinese",
};

/**
 * Format a locale code to a display name
 * @param locale - The locale code (e.g., "en", "fr")
 * @returns The formatted display name (e.g., "English", "French")
 */
export function formatLocaleName(locale: string): string {
  return LOCALE_DISPLAY_NAMES[locale] || locale.toUpperCase();
}

export const selector: DocumentSelector = [
  { language: "javascript" },
  { language: "typescript" },
  { language: "javascriptreact" },
  { language: "typescriptreact" },
  { language: "vue" },
  { language: "svelte" },
];
