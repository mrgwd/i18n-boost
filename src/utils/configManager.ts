import {
  discoverSupportedLocales,
  getLocaleFilePath,
  detectFileNamingPattern,
  LocaleInfo,
  LocaleRoot,
  discoverLocaleRoots,
} from "./localeDiscovery";
import { workspace, Disposable, Uri } from "vscode";

export interface I18nBoostSettings {
  localesPaths: string[];
  defaultLocale: string;
  functionNames: string[];
  fileNamingPattern: "locale.json" | "locale/**/*.json" | "auto";
  keyStrategy: "filename" | "flat";
  enabled: boolean;
}

export class ConfigManager {
  private settings: I18nBoostSettings | null = null;
  private supportedLocales: LocaleInfo[] | null = null;
  private localeRoots: LocaleRoot[] | null = null;

  /**
   * Load settings from VS Code configuration
   */
  async loadSettings(): Promise<I18nBoostSettings> {
    if (this.settings) return this.settings;

    const config = workspace.getConfiguration("i18nBoost");

    const rawLocalesPath = config.get<string | string[]>("localesPath");
    const localesPaths = Array.isArray(rawLocalesPath)
      ? rawLocalesPath
      : [rawLocalesPath || "src/i18n"];

    this.settings = {
      localesPaths,
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
          "fileNamingPattern",
        ) || "auto",
      keyStrategy: config.get<"filename" | "flat">("keyStrategy") || "filename",
      enabled: config.get<boolean>("enabled") !== false,
    };

    if (this.settings.fileNamingPattern === "auto") {
      this.settings.fileNamingPattern = await detectFileNamingPattern(
        this.settings.localesPaths,
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
   * Get the locales paths
   */
  async getLocalesPaths(): Promise<string[]> {
    const settings = await this.getSettings();
    return settings.localesPaths;
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
   * Get discoverd locale roots (cached)
   */
  async getLocaleRoots(): Promise<LocaleRoot[]> {
    if (this.localeRoots) return this.localeRoots;
    const settings = await this.getSettings();
    this.localeRoots = await discoverLocaleRoots(settings.localesPaths);
    return this.localeRoots;
  }

  /**
   * Dynamically discover and cache supported locales.
   * If documentUri is provided, filters locales based on monorepo context.
   */
  async getSupportedLocales(documentUri?: Uri): Promise<LocaleInfo[]> {
    const settings = await this.getSettings();

    // Always discover all locales first (cached if possible)
    if (!this.supportedLocales) {
      this.supportedLocales = await discoverSupportedLocales(
        settings.localesPaths,
        settings.fileNamingPattern as any,
      );
    }

    if (!documentUri) {
      return this.supportedLocales;
    }

    // Filter based on context
    const resolvedRoots = await this.resolveLocaleRoots(documentUri);

    // Return locales that belong to any of the resolved roots
    return this.supportedLocales.filter((locale) =>
      resolvedRoots.some((root) => locale.path.startsWith(root)),
    );
  }

  /**
   * Get available locales
   */
  async getAvailableLocales(documentUri?: Uri): Promise<LocaleInfo[]> {
    return await this.getSupportedLocales(documentUri);
  }

  /**
   * Get all file paths for a specific locale (context-aware)
   */
  async getLocaleFilePaths(
    locale: string,
    documentUri?: Uri,
  ): Promise<string[]> {
    const settings = await this.getSettings();

    if (documentUri) {
      const locales = await this.getSupportedLocales(documentUri);
      return locales.filter((l) => l.locale === locale).map((l) => l.path);
    }

    // Fallback if no context: return all discovered paths for this locale
    if (this.supportedLocales) {
      return this.supportedLocales
        .filter((l) => l.locale === locale)
        .map((l) => l.path);
    }

    // Ultimate fallback for static paths (legacy)
    return [
      getLocaleFilePath(
        locale,
        settings.localesPaths,
        settings.fileNamingPattern as any,
      ),
    ];
  }

  /**
   * Get file path for a specific locale (returns first match)
   * @deprecated Use getLocaleFilePaths instead for monorepo support
   */
  async getLocaleFilePath(locale: string, documentUri?: Uri): Promise<string> {
    const paths = await this.getLocaleFilePaths(locale, documentUri);
    return paths.length > 0 ? paths[0] : "";
  }

  /**
   * Reset cached settings and locales (useful when settings change)
   */
  resetCache(): void {
    this.settings = null;
    this.supportedLocales = null;
    this.localeRoots = null;
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

  /**
   * Resolves the list of relevant locale roots for a given document.
   * Implements Group-based Isolation:
   * 1. Own Root (ancestor): Include.
   * 2. Shared Roots (different pattern index): Include.
   * 3. Sibling Roots (same pattern index but different path): Exclude.
   */
  async resolveLocaleRoots(documentUri: Uri): Promise<string[]> {
    const allRoots = await this.getLocaleRoots();
    const docPath = documentUri.fsPath;

    // 1. Find Primary Root (Closest Ancestor)
    // We sort roots by length descending to find the longest matching prefix (deepest ancestor)
    const sortedRoots = [...allRoots].sort(
      (a, b) => b.path.length - a.path.length,
    );
    const primaryRoot = sortedRoots.find((r) => docPath.startsWith(r.path));

    if (!primaryRoot) {
      // If no ancestor found, maybe this file is outside any known app/lib?
      // Fallback: return all roots or just shared?
      // Let's return all for maximum discoverability if we can't determine context.
      return allRoots.map((r) => r.path);
    }

    // 2. Filter Roots
    return allRoots
      .filter((root) => {
        // Include Primary Root
        if (root.path === primaryRoot.path) return true;

        // Exclude Siblings (Same Pattern Index)
        if (root.sourcePatternIndex === primaryRoot.sourcePatternIndex)
          return false;

        // Include Shared (Different Pattern Index)
        return true;
      })
      .map((r) => r.path);
  }
}
