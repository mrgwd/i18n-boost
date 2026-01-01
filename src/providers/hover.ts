import { ConfigManager } from "../utils/configManager";
import { getKeyPathAtPosition } from "../utils/jsonWalker";
import { getTranslationKeyAtPosition } from "../utils/translationKeyAtPosition";
import { formatLocaleName } from "../utils/constants";
import {
  HoverProvider,
  Hover,
  MarkdownString,
  TextDocument,
  Position,
  workspace,
  languages,
  DocumentSelector,
  Disposable,
} from "vscode";
import { basename, join, sep, normalize } from "path";
export class I18nHoverProvider implements HoverProvider {
  constructor(private configManager: ConfigManager) {}

  async provideHover(
    document: TextDocument,
    position: Position
  ): Promise<Hover | null> {
    // First, handle JSON locale files (existing behavior)
    if (await this.isLocaleFile(document)) {
      const offset = document.offsetAt(position);
      const text = document.getText();
      let keyPath = getKeyPathAtPosition(text, offset);
      if (!keyPath) return null;

      // For multi-file structures (Cases 3 & 4), prepend the file prefix
      const filePrefix = await this.extractFilePrefix(document);
      if (filePrefix) {
        keyPath = `${filePrefix}.${keyPath}`;
      }

      const currentLocale = await this.extractCurrentLocale(document);
      const supportedLocales = await this.configManager.getSupportedLocales();
      const otherLocales = supportedLocales.filter(
        (l) => l.locale !== currentLocale && l.exists
      );
      if (otherLocales.length === 0) return null;

      const links = otherLocales.map((locale) => {
        const args = encodeURIComponent(
          JSON.stringify([keyPath, locale.locale])
        );
        return `[Go to ${formatLocaleName(
          locale.locale
        )}](command:i18nBoost.navigateToLocaleKey?${args})`;
      });

      const hoverContent = new MarkdownString(links.join(" | "));
      hoverContent.isTrusted = true;
      return new Hover(hoverContent);
    }

    // Then, handle code files: show navigation links for translation keys inside t('...')
    const translationKey = await getTranslationKeyAtPosition(
      document,
      position,
      this.configManager
    );
    if (!translationKey) return null;

    const supportedLocales = await this.configManager.getSupportedLocales();
    const existingLocales = supportedLocales.filter((l) => l.exists);
    if (existingLocales.length === 0) return null;
    const links = existingLocales.map((locale) => {
      const args = encodeURIComponent(
        JSON.stringify([translationKey, locale.locale])
      );
      return `[Go to ${formatLocaleName(
        locale.locale
      )}](command:i18nBoost.navigateToLocaleKey?${args})`;
    });

    const hoverContent = new MarkdownString(links.join(" | "));
    hoverContent.isTrusted = true;
    return new Hover(hoverContent);
  }

  private async isLocaleFile(document: TextDocument): Promise<boolean> {
    if (document.languageId !== "json" && document.languageId !== "jsonc")
      return false;
    const localesPath = await this.configManager.getLocalesPath();
    if (!localesPath) return false;
    const wsFolders = workspace.workspaceFolders;
    if (!wsFolders) return false;
    const workspaceRoot = wsFolders[0].uri.fsPath;
    const fullLocalesPath = join(workspaceRoot, localesPath);
    return document.uri.fsPath.startsWith(fullLocalesPath);
  }

  private async extractCurrentLocale(document: TextDocument): Promise<string> {
    const fileName = basename(document.uri.fsPath);
    const fileNamingPattern = await this.configManager.getFileNamingPattern();
    if (fileNamingPattern === "locale.json") {
      return fileName.replace(".json", "");
    } else {
      const pathParts = document.uri.fsPath.split(sep);
      const localesPath = await this.configManager.getLocalesPath();
      const localesIndex = pathParts.findIndex(
        (part) => part === localesPath.split("/").pop()
      );
      if (localesIndex !== -1 && localesIndex + 1 < pathParts.length) {
        return pathParts[localesIndex + 1];
      }
    }
    return "en";
  }

  /**
   * Extract the file prefix that should be prepended to keys
   * For multi-file structures (Cases 3 & 4), the filename/folder path is part of the key
   *
   * Examples:
   * - en/errors.json -> "errors"
   * - en/auth/login.json -> "auth.login"
   * - en/common.json -> "" (special case, no prefix)
   * - en/index.json -> "" (special case, no prefix)
   * - en.json -> "" (flat structure, no prefix)
   */
  private async extractFilePrefix(document: TextDocument): Promise<string> {
    const fileNamingPattern = await this.configManager.getFileNamingPattern();

    // Case 1: Flat structure (en.json, ar.json) - no prefix
    if (fileNamingPattern === "locale.json") {
      return "";
    }

    // Cases 2, 3, 4: Directory-based structure
    const localesPath = await this.configManager.getLocalesPath();

    // Get workspace root and construct full locales path
    const wsFolders = workspace.workspaceFolders;
    if (!wsFolders || wsFolders.length === 0) {
      return "";
    }

    const workspaceRoot = wsFolders[0].uri.fsPath;
    const fullLocalesPath = join(workspaceRoot, localesPath);

    const docFsPath = document.uri.fsPath;
    const normalizedDoc = normalize(docFsPath);
    const normalizedLocales = normalize(fullLocalesPath) + sep;

    if (!normalizedDoc.startsWith(normalizedLocales)) {
      return "";
    }

    // Get relative path from locales folder
    const relativePath = normalizedDoc.substring(normalizedLocales.length);
    const pathParts = relativePath.split(sep);

    // Remove locale name (first part, e.g., "en", "ar")
    if (pathParts.length > 0) {
      pathParts.shift();
    }

    // If no parts left, it's Case 2 (single file in locale folder)
    if (pathParts.length === 0) {
      return "";
    }

    // Build prefix from remaining parts
    const prefixParts: string[] = [];

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];

      // Last part is the filename
      if (i === pathParts.length - 1) {
        const filename = part.replace(".json", "");
        // Skip common.json and index.json as they don't add to the key prefix
        if (filename !== "common" && filename !== "index") {
          prefixParts.push(filename);
        }
      } else {
        // Folder names are always part of the prefix
        prefixParts.push(part);
      }
    }

    const result = prefixParts.join(".");
    return result;
  }
}

export function registerHoverProvider(
  configManager: ConfigManager
): Disposable {
  const jsonProvider = languages.registerHoverProvider(
    { language: "json", scheme: "file" },
    new I18nHoverProvider(configManager)
  );

  const selector: DocumentSelector = [
    { language: "javascript" },
    { language: "typescript" },
    { language: "javascriptreact" },
    { language: "typescriptreact" },
    { language: "vue" },
    { language: "svelte" },
  ];

  const codeProvider = languages.registerHoverProvider(
    selector,
    new I18nHoverProvider(configManager)
  );

  return Disposable.from(jsonProvider, codeProvider);
}
