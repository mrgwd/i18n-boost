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
  Disposable,
} from "vscode";
import { ConfigManager } from "../utils/configManager";
import { findBaseKey } from "../utils/findBaseKey";
import { existsSync, readFileSync, statSync } from "fs";
import { parse } from "jsonc-parser";
import { join } from "path";
import { LocaleRoot } from "../utils/localeDiscovery";

export class I18nCompletionProvider implements CompletionItemProvider {
  // Cache translations per root path
  private translationsCache: Map<string, any> = new Map();
  private watchers: Disposable[] = [];

  constructor(
    private configManager: ConfigManager,
    onConfigChange?: () => void,
  ) {
    this.loadTranslations();
    // Reload translations when the config changes
    workspace.onDidChangeConfiguration(() => this.loadTranslations());

    // Listen for config file changes
    if (onConfigChange) {
      // Call the callback immediately to set up the listener
      onConfigChange();
    }
  }

  /**
   * Method to reload translations when config changes
   */
  public async reloadTranslations() {
    await this.loadTranslations();
  }

  /**
   * Loads and parses the translation file for the default locale from ALL roots.
   */
  private async loadTranslations() {
    const enabled = await this.configManager.isEnabled();
    if (!enabled) {
      this.translationsCache.clear();
      return;
    }

    // Clear existing cache
    this.translationsCache.clear();

    const roots = await this.configManager.getLocaleRoots();
    if (!roots || roots.length === 0) return;

    // Load translations for each root
    for (const root of roots) {
      await this.loadTranslationsForRoot(root);
    }

    // Setup watchers for the roots
    this.setupWatchers(roots);
  }

  private async loadTranslationsForRoot(root: LocaleRoot) {
    try {
      const defaultLocale = await this.configManager.getDefaultLocale();
      const fileNamingPattern = await this.configManager.getFileNamingPattern();
      const keyStrategy = await this.configManager.getKeyStrategy();

      let defaultLocalePath: string;

      // Determine path to default locale for this root
      if (fileNamingPattern === "locale.json") {
        defaultLocalePath = join(root.path, `${defaultLocale}.json`);
      } else {
        defaultLocalePath = join(root.path, defaultLocale);
      }

      let translations: any = {};

      if (existsSync(defaultLocalePath)) {
        const stats = statSync(defaultLocalePath);

        if (stats.isDirectory()) {
          translations = this.loadDirectory(defaultLocalePath, keyStrategy);
        } else {
          const content = readFileSync(defaultLocalePath, "utf-8");
          translations = parse(content);
        }
      }

      this.translationsCache.set(root.path, translations);
    } catch (error) {
      // Failed to load
      console.error(`Failed to load translations for root ${root.path}`, error);
    }
  }

  private setupWatchers(roots: LocaleRoot[]) {
    // Dispose old watchers
    this.watchers.forEach((w) => w.dispose());
    this.watchers = [];

    // Create new watchers for each root
    // We watch the root directory for any JSON changes
    for (const root of roots) {
      try {
        if (!existsSync(root.path)) continue;

        const pattern = new RelativePattern(root.path, "**/*.json");
        const watcher = workspace.createFileSystemWatcher(pattern);

        // Reload specific root on change?
        // For simplicity and correctness with "auto" patterns/resolutions,
        // we can reload just the root or everything.
        // Let's reload just the root to be efficient.
        const reloadRoot = () => this.loadTranslationsForRoot(root);

        watcher.onDidChange(reloadRoot);
        watcher.onDidCreate(reloadRoot);
        watcher.onDidDelete(reloadRoot);

        this.watchers.push(watcher);
      } catch (e) {
        console.error("Failed to setup watcher for", root.path, e);
      }
    }
  }

  private loadDirectory(
    dirPath: string,
    keyStrategy: "filename" | "flat",
  ): any {
    const fs = require("fs");
    const path = require("path");
    const result: any = {};

    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const item of items) {
        if (item.isFile() && item.name.endsWith(".json")) {
          try {
            const content = fs.readFileSync(
              path.join(dirPath, item.name),
              "utf-8",
            );
            const json = parse(content);
            const fileName = item.name.replace(".json", "");

            if (keyStrategy === "flat") {
              // Flatten all files into root
              Object.assign(result, json);
            } else {
              if (fileName === "common" || fileName === "index") {
                // Flatten common.json and index.json into root
                Object.assign(result, json);
              } else {
                // Namespace other files
                result[fileName] = json;
              }
            }
          } catch (e) {
            // Ignore bad files
          }
        } else if (item.isDirectory()) {
          const subResult = this.loadDirectory(
            path.join(dirPath, item.name),
            keyStrategy,
          );

          if (keyStrategy === "flat") {
            // Flatten subdirectories into root
            Object.assign(result, subResult);
          } else {
            const key = item.name;
            result[key] = subResult;
          }
        }
      }
    } catch (e) {
      /* ignore */
    }

    return result;
  }

  /**
   * Deep merge two objects.
   */
  private deepMerge(target: any, source: any) {
    if (typeof target !== "object" || target === null) return source;
    if (typeof source !== "object" || source === null) return source; // Override if source is primitive? Or ignore?

    for (const key of Object.keys(source)) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (Array.isArray(sourceValue)) {
        // Extract array? Or replace?
        // i18n keys usually usually don't have arrays that merge.
        target[key] = sourceValue;
      } else if (typeof sourceValue === "object" && sourceValue !== null) {
        if (!target[key]) {
          target[key] = {};
        }
        this.deepMerge(target[key], sourceValue);
      } else {
        target[key] = sourceValue;
      }
    }
    return target;
  }

  /**
   * The main method that provides completion items.
   * @param document The active text document.
   * @param position The position of the cursor.
   * @returns A list of completion items or undefined.
   */
  public async provideCompletionItems(
    document: TextDocument,
    position: Position,
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

    // --- Resolve Relevant Translations ---
    // 1. Get relevant roots for this document
    const relevantRoots = await this.configManager.resolveLocaleRoots(
      document.uri,
    );

    // 2. Merge translations from these roots
    const mergedTranslations = {};
    for (const rootPath of relevantRoots) {
      const rootTranslations = this.translationsCache.get(rootPath);
      if (rootTranslations) {
        this.deepMerge(mergedTranslations, rootTranslations);
      }
    }

    // --- Continue with existing logic using mergedTranslations ---

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

    let currentObject: Record<string, any> = mergedTranslations;
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
        isObject ? CompletionItemKind.Module : CompletionItemKind.Value,
      );

      if (isObject) {
        item.insertText = new SnippetString(key + ".");
        item.documentation = new MarkdownString(
          "This key has nested translations.",
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
