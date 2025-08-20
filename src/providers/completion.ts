import * as vscode from "vscode";
import * as fs from "fs";
import * as jsonc from "jsonc-parser";
import { ConfigManager } from "../utils/configManager";
import { findBaseKey } from "../utils/findBaseKey";

/**
 * A completion provider for i18n keys that dynamically loads translations.
 * It suggests keys based on the user's input within configured function calls.
 */
export class I18nCompletionProvider implements vscode.CompletionItemProvider {
  private translations: any = {};

  constructor(private configManager: ConfigManager) {
    this.loadTranslations();
    // Reload translations when the config changes
    vscode.workspace.onDidChangeConfiguration(() => this.loadTranslations());

    // Also reload when the default locale file is saved/changed
    (async () => {
      const config = await this.configManager.loadConfig();
      if (!config) return;
      const defaultLocaleFile = this.configManager.getLocaleFilePath(
        config.defaultLocale,
        config
      );
      const watcher =
        vscode.workspace.createFileSystemWatcher(defaultLocaleFile);
      watcher.onDidChange(() => this.loadTranslations());
      watcher.onDidCreate(() => this.loadTranslations());
      watcher.onDidDelete(() => (this.translations = {}));
    })();
  }

  /**
   * Loads and parses the translation file for the default locale.
   */
  private async loadTranslations() {
    const config = await this.configManager.loadConfig();
    if (!config || !config.enabled) {
      this.translations = {};
      return;
    }

    try {
      const defaultLocaleFile = this.configManager.getLocaleFilePath(
        config.defaultLocale,
        config
      );
      if (fs.existsSync(defaultLocaleFile)) {
        const content = fs.readFileSync(defaultLocaleFile, "utf-8");
        this.translations = jsonc.parse(content);
      } else {
        this.translations = {};
      }
    } catch (error) {
      console.error("Failed to load or parse translation file:", error);
      this.translations = {};
    }
  }

  /**
   * The main method that provides completion items.
   * @param document The active text document.
   * @param position The position of the cursor.
   * @returns A list of completion items or undefined.
   */
  public async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.CompletionItem[]> {
    const config = await this.configManager.loadConfig();
    if (!config || !config.enabled) {
      return [];
    }

    const linePrefix = document
      .lineAt(position)
      .text.substring(0, position.character);

    // Build a dynamic regex from the function names in the config
    const functionNamesPattern = config.functionNames
      .map((name) => name.replace(".", "\\."))
      .join("|");
    const regex = new RegExp(`(?:${functionNamesPattern})\\(['"\`]([^'"\`]*)$`);
    const match = linePrefix.match(regex);

    if (!match) {
      return []; // Not inside a configured translation function.
    }

    let keyPath = match[1];
    // --- Add base key logic ---
    const baseKey = findBaseKey(document, position);
    if (baseKey && keyPath.length === 0) {
      keyPath = baseKey + ".";
    } else if (baseKey && !keyPath.startsWith(baseKey + ".")) {
      // User is typing t("some.key") with a base key, combine them
      keyPath = baseKey + "." + keyPath;
    }
    // --- End base key logic ---

    const pathParts = keyPath.split(".").filter((p) => p.length > 0);

    let currentObject: any = this.translations;
    let lastPart = "";

    try {
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        if (i === pathParts.length - 1 && !keyPath.endsWith(".")) {
          // If this is the last part and the key doesn't end with a dot,
          // check if the user is currently typing something
          const userInput = match[1]; // What the user actually typed in t("...")
          if (userInput.length === 0) {
            // User typed t("") with a base key, suggest all children
            lastPart = "";
          } else {
            // User is typing a partial key, use it as the filter
            lastPart = part;
          }
        } else if (currentObject[part]) {
          currentObject = currentObject[part];
        } else {
          return []; // Invalid path
        }
      }
    } catch (error) {
      console.error("Error navigating translation keys:", error);
      return [];
    }

    if (typeof currentObject !== "object" || currentObject === null) {
      return [];
    }

    const suggestions: vscode.CompletionItem[] = [];
    const keys = Object.keys(currentObject);
    const filteredKeys = keys.filter((key) => key.startsWith(lastPart));

    for (const key of filteredKeys) {
      const value = currentObject[key];
      const isObject = typeof value === "object" && value !== null;

      const item = new vscode.CompletionItem(
        key,
        isObject
          ? vscode.CompletionItemKind.Module
          : vscode.CompletionItemKind.Value
      );

      if (isObject) {
        item.insertText = new vscode.SnippetString(key + ".");
        item.documentation = new vscode.MarkdownString(
          "This key has nested translations."
        );
        item.command = {
          command: "editor.action.triggerSuggest",
          title: "Re-trigger suggestions",
        };
      } else {
        item.insertText = key;
        item.documentation = new vscode.MarkdownString(
          `**Translation:** \`${value}\``
        );
      }

      suggestions.push(item);
    }

    return suggestions;
  }
}
