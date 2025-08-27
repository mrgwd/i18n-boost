export interface I18nBoostConfig {
  localesPath: string;
  defaultLocale: string;
  supportedLocales: string[];
  functionNames: string[];
  fileNamingPattern: "locale.json" | "locale/common.json" | "locale/index.json";
  enabled: boolean;
}
