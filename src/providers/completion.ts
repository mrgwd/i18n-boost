import {
  CompletionItemProvider,
  CompletionItem,
  CompletionItemKind,
  Position,
  TextDocument,
  workspace,
  SnippetString,
  MarkdownString,
  RelativePattern,
  FileSystemWatcher,
} from "vscode";
import { ConfigManager } from "../utils/configManager";
import { findBaseKey } from "../utils/findBaseKey";
import { existsSync, readFileSync } from "fs";
import { parse } from "jsonc-parser";

/**
 * A completion provider for i18n keys that dynamically loads translations.
 * It suggests keys based on the user's input within configured function calls.
 */
export class I18nCompletionProvider implements CompletionItemProvider {
  private translations: Record<string, any> = {};
  private watcher: FileSystemWatcher | undefined;

  constructor(
    private configManager: ConfigManager,
    onConfigChange?: () => void
  ) {
    this.loadTranslations();
    // Reload translations when the config changes
    workspace.onDidChangeConfiguration(() => this.loadTranslations());

    // Listen for config file changes
    if (onConfigChange) {
      // Call the callback immediately to set up the listener
      onConfigChange();
    }

    // Setup and keep a persistent watcher for default locale files
    (async () => {
      await this.setupWatcher();
    })();
    workspace.onDidChangeConfiguration(async () => {
      await this.setupWatcher();
    });
  }

  /**
   * Method to reload translations when config changes
   */
  public reloadTranslations() {
    this.loadTranslations();
  }

  /**
   * Loads and parses the translation file for the default locale.
   */
  private async loadTranslations() {
    const enabled = await this.configManager.isEnabled();
    if (!enabled) {
      this.translations = {};
      return;
    }

    try {
      const defaultLocale = await this.configManager.getDefaultLocale();
      const defaultLocalePath = await this.configManager.getLocaleFilePath(
        defaultLocale
      );

      if (existsSync(defaultLocalePath)) {
        const stats = require("fs").statSync(defaultLocalePath);
        if (stats.isDirectory()) {
          this.translations = this.loadDirectory(defaultLocalePath);
        } else {
          const content = readFileSync(defaultLocalePath, "utf-8");
          this.translations = parse(content);
        }
      } else {
        this.translations = {};
      }
    } catch (error) {
      // Failed to load or parse translation file
      this.translations = {};
    }
  }

  private async setupWatcher() {
    try {
      const defaultLocale = await this.configManager.getDefaultLocale();
      const defaultLocalePath = await this.configManager.getLocaleFilePath(
        defaultLocale
      );

      let watcherPattern: any;
      try {
        const fs = require("fs");
        const path = require("path");
        if (
          fs.existsSync(defaultLocalePath) &&
          fs.statSync(defaultLocalePath).isDirectory()
        ) {
          watcherPattern = new RelativePattern(defaultLocalePath, "**/*.json");
        } else {
          watcherPattern = new RelativePattern(
            path.dirname(defaultLocalePath),
            path.basename(defaultLocalePath)
          );
        }
      } catch (e) {
        return;
      }

      this.watcher?.dispose();
      this.watcher = workspace.createFileSystemWatcher(watcherPattern);
      this.watcher.onDidChange(() => {
        this.loadTranslations();
      });
      this.watcher.onDidCreate(() => {
        this.loadTranslations();
      });
      this.watcher.onDidDelete(() => {
        this.loadTranslations();
      });
    } catch (e) {
      return;
    }
  }

  private loadDirectory(dirPath: string): any {
    const fs = require("fs");
    const path = require("path");
    const result: any = {};

    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (item.isFile() && item.name.endsWith(".json")) {
        try {
          const content = fs.readFileSync(
            path.join(dirPath, item.name),
            "utf-8"
          );
          const json = parse(content);
          const fileName = item.name.replace(".json", "");

          if (fileName === "common" || fileName === "index") {
            // Flatten common.json and index.json into root
            Object.assign(result, json);
          } else {
            // Namespace other files
            result[fileName] = json;
          }
        } catch (e) {
          // Ignore bad files
        }
      } else if (item.isDirectory()) {
        const key = item.name;
        result[key] = this.loadDirectory(path.join(dirPath, item.name));
      }
    }

    return result;
  }

  /**
   * The main method that provides completion items.
   * @param document The active text document.
   * @param position The position of the cursor.
   * @returns A list of completion items or undefined.
   */
  public async provideCompletionItems(
    document: TextDocument,
    position: Position
  ): Promise<CompletionItem[]> {
    const enabled = await this.configManager.isEnabled();
    if (!enabled) {
      return [];
    }

    const linePrefix = document
      .lineAt(position)
      .text.substring(0, position.character);

    // Build a dynamic regex from the function names in the config
    const functionNames = await this.configManager.getFunctionNames();
    const functionNamesPattern = functionNames
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

    let currentObject: Record<string, any> = this.translations;
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
      // Error navigating translation keys
      return [];
    }

    if (typeof currentObject !== "object" || currentObject === null) {
      return [];
    }

    const suggestions: CompletionItem[] = [];
    const keys = Object.keys(currentObject);
    const filteredKeys = keys.filter((key) => key.startsWith(lastPart));
    for (const key of filteredKeys) {
      const value = currentObject[key];
      const isObject = typeof value === "object" && value !== null;

      const item = new CompletionItem(
        key,
        isObject ? CompletionItemKind.Module : CompletionItemKind.Value
      );
      item.sortText = "0" + key;

      if (isObject) {
        item.insertText = new SnippetString(key + ".");
        item.documentation = new MarkdownString(
          "This key has nested translations."
        );
        item.command = {
          command: "editor.action.triggerSuggest",
          title: "Re-trigger suggestions",
        };
      } else {
        item.insertText = key;
        item.detail = `  ${value}`;
      }

      suggestions.push(item);
    }

    return suggestions;
  }
}
