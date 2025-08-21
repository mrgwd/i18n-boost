import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { I18nBoostConfig } from "../types";

const CONFIG_FILE_NAME = "i18nBoost.config.ts" as const;

export class ConfigManager {
  private config: I18nBoostConfig | null = null;
  private configPath: string | null = null;

  async hasConfig(): Promise<boolean> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return false;

    for (const folder of workspaceFolders) {
      const configPath = path.join(folder.uri.fsPath, CONFIG_FILE_NAME);
      if (fs.existsSync(configPath)) {
        this.configPath = configPath;
        return true;
      }
    }
    return false;
  }

  async loadConfig(): Promise<I18nBoostConfig | null> {
    if (this.config) return this.config;

    if (!(await this.hasConfig()) || !this.configPath) {
      return null;
    }

    try {
      const configContent = fs.readFileSync(this.configPath, "utf8");
      this.config = this.parseTypeScriptConfig(configContent);
      return this.config;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load config: ${error}`);
      return null;
    }
  }

  private parseTypeScriptConfig(content: string): I18nBoostConfig {
    // Remove comments
    const withoutComments = content
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    // Extract the export const with type annotation
    const exportMatch = withoutComments.match(
      /export\s+const\s+i18nBoostConfig\s*:\s*I18nBoostConfig\s*=\s*({[\s\S]*?});?\s*$/
    );
    if (!exportMatch) {
      throw new Error(
        "Config file must have an export const with I18nBoostConfig type annotation"
      );
    }

    let configObjectStr = exportMatch[1];
    const config: any = {};

    // Extract string properties
    const stringProps = ["localesPath", "defaultLocale", "fileNamingPattern"];
    for (const prop of stringProps) {
      const match = configObjectStr.match(
        new RegExp(`${prop}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`)
      );
      if (match) {
        config[prop] = match[1];
      }
    }

    // Extract boolean properties
    const enabledMatch = configObjectStr.match(/enabled\s*:\s*(true|false)/);
    if (enabledMatch) {
      config.enabled = enabledMatch[1] === "true";
    }

    // Extract arrays
    const supportedLocalesMatch = configObjectStr.match(
      /supportedLocales\s*:\s*\[([\s\S]*?)\]/
    );
    if (supportedLocalesMatch) {
      config.supportedLocales = this.parseStringArray(supportedLocalesMatch[1]);
    }

    const functionNamesMatch = configObjectStr.match(
      /functionNames\s*:\s*\[([\s\S]*?)\]/
    );
    if (functionNamesMatch) {
      config.functionNames = this.parseStringArray(functionNamesMatch[1]);
    }

    // Set defaults for missing values
    return {
      localesPath: config.localesPath || "src/i18n",
      defaultLocale: config.defaultLocale || "en",
      supportedLocales: config.supportedLocales || ["en"],
      functionNames: config.functionNames || ["t", "translate"],
      fileNamingPattern: config.fileNamingPattern || "locale.json",
      enabled: config.enabled !== false,
    };
  }

  private parseStringArray(arrayContent: string): string[] {
    const items: string[] = [];
    const matches = arrayContent.match(/['"\`]([^'"\`]+)['"\`]/g);
    if (matches) {
      for (const match of matches) {
        const cleaned = match.replace(/['"\`]/g, "");
        if (cleaned.trim()) {
          items.push(cleaned.trim());
        }
      }
    }
    return items;
  }

  getWorkspacePath(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    return workspaceFolders ? workspaceFolders[0].uri.fsPath : null;
  }

  getLocalesPath(): string | null {
    const workspacePath = this.getWorkspacePath();
    if (!workspacePath || !this.config) return null;

    return path.join(workspacePath, this.config.localesPath);
  }

  /**
   * Get available locale files based on configuration
   */
  async getAvailableLocales(): Promise<
    { locale: string; path: string; exists: boolean }[]
  > {
    const config = await this.loadConfig();
    if (!config) return [];

    const localesPath = this.getLocalesPath();
    if (!localesPath || !fs.existsSync(localesPath)) return [];

    const locales: { locale: string; path: string; exists: boolean }[] = [];

    for (const locale of config.supportedLocales) {
      const filePath = this.getLocaleFilePath(locale, config);
      locales.push({
        locale: locale,
        path: filePath,
        exists: fs.existsSync(filePath),
      });
    }

    return locales;
  }

  /**
   * Get file path for a specific locale
   */
  getLocaleFilePath(locale: string, config?: I18nBoostConfig): string {
    const activeConfig = config || this.config;
    if (!activeConfig) {
      throw new Error("No configuration loaded");
    }

    const localesPath = this.getLocalesPath()!;

    switch (activeConfig.fileNamingPattern) {
      case "locale.json":
        return path.join(localesPath, `${locale}.json`);
      case "locale/common.json":
        return path.join(localesPath, locale, "common.json");
      case "locale/index.json":
        return path.join(localesPath, locale, "index.json");
      default:
        return path.join(localesPath, `${locale}.json`);
    }
  }

  /**
   * Reset cached config (useful when config file is modified)
   */
  resetCache(): void {
    this.config = null;
    this.configPath = null;
  }
}
