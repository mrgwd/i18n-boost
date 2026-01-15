import {
  discoverSupportedLocales,
  getLocaleFilePath,
  detectFileNamingPattern,
  LocaleInfo,
} from "./localeDiscovery";
import { workspace, Disposable } from "vscode";

export interface I18nBoostSettings {
  localesPath: string;
  defaultLocale: string;
  functionNames: string[];
  fileNamingPattern: "locale.json" | "locale/**/*.json" | "auto";
  keyStrategy: "filename" | "flat";
  enabled: boolean;
}

export class ConfigManager {
  private settings: I18nBoostSettings | null = null;
  private supportedLocales: LocaleInfo[] | null = null;

  /**
   * Load settings from VS Code configuration
   */
  async loadSettings(): Promise<I18nBoostSettings> {
    if (this.settings) return this.settings;

    const config = workspace.getConfiguration("i18nBoost");

    this.settings = {
      localesPath: config.get<string>("localesPath") || "src/i18n",
      defaultLocale: config.get<string>("defaultLocale") || "en",
      functionNames: config.get<string[]>("functionNames") || [
        "t",
        "translate",
        "$t",
        "i18n.t",
        "t.raw",
        "t.rich",
      ],
      fileNamingPattern:
        config.get<"locale.json" | "locale/**/*.json" | "auto">(
          "fileNamingPattern"
        ) || "auto",
      keyStrategy: config.get<"filename" | "flat">("keyStrategy") || "filename",
      enabled: config.get<boolean>("enabled") !== false,
    };

    if (this.settings.fileNamingPattern === "auto") {
      this.settings.fileNamingPattern = detectFileNamingPattern(
        this.settings.localesPath
      );
    }

    return this.settings;
  }

  /**
   * Get current settings (loads if not already loaded)
   */
  async getSettings(): Promise<I18nBoostSettings> {
    return await this.loadSettings();
  }

  /**
   * Check if the extension is enabled
   */
  async isEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.enabled;
  }

  /**
   * Get the locales path
   */
  async getLocalesPath(): Promise<string> {
    const settings = await this.getSettings();
    return settings.localesPath;
  }

  /**
   * Get the default locale
   */
  async getDefaultLocale(): Promise<string> {
    const settings = await this.getSettings();
    return settings.defaultLocale;
  }

  /**
   * Get function names for translation detection
   */
  async getFunctionNames(): Promise<string[]> {
    const settings = await this.getSettings();
    return settings.functionNames;
  }

  /**
   * Get file naming pattern
   */
  async getFileNamingPattern(): Promise<
    "locale.json" | "locale/**/*.json" | "auto"
  > {
    const settings = await this.getSettings();
    return settings.fileNamingPattern;
  }

  /**
   * Get key strategy
   */
  async getKeyStrategy(): Promise<"filename" | "flat"> {
    const settings = await this.getSettings();
    return settings.keyStrategy;
  }

  /**
   * Dynamically discover and cache supported locales
   */
  async getSupportedLocales(): Promise<LocaleInfo[]> {
    if (this.supportedLocales) return this.supportedLocales;

    const settings = await this.getSettings();
    this.supportedLocales = await discoverSupportedLocales(
      settings.localesPath,
      settings.fileNamingPattern as any
    );

    return this.supportedLocales;
  }

  /**
   * Get available locales (same as getSupportedLocales for backward compatibility)
   */
  async getAvailableLocales(): Promise<LocaleInfo[]> {
    return await this.getSupportedLocales();
  }

  /**
   * Get file path for a specific locale
   */
  async getLocaleFilePath(locale: string): Promise<string> {
    const settings = await this.getSettings();
    return getLocaleFilePath(
      locale,
      settings.localesPath,
      settings.fileNamingPattern as any
    );
  }

  /**
   * Reset cached settings and locales (useful when settings change)
   */
  resetCache(): void {
    this.settings = null;
    this.supportedLocales = null;
  }

  /**
   * Listen for configuration changes and reset cache
   */
  setupConfigurationWatcher(): Disposable {
    return workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("i18nBoost")) {
        this.resetCache();
      }
    });
  }
}
