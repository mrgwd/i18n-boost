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
  languages,
  DocumentSelector,
  Disposable,
} from "vscode";
import { basename, sep, normalize } from "path";

export class I18nHoverProvider implements HoverProvider {
  constructor(private configManager: ConfigManager) {}

  async provideHover(
    document: TextDocument,
    position: Position,
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
      const supportedLocales = await this.configManager.getSupportedLocales(
        document.uri,
      );

      const otherLocales = supportedLocales.filter(
        (l) => l.locale !== currentLocale && l.exists,
      );
      if (otherLocales.length === 0) return null;

      const uniqueOtherLocales = Array.from(
        new Map(otherLocales.map((l) => [l.locale, l])).values(),
      );

      const links = uniqueOtherLocales.map((locale) => {
        const args = encodeURIComponent(
          JSON.stringify([keyPath, locale.locale, document.uri.toString()]),
        );
        return `[Go to ${formatLocaleName(
          locale.locale,
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
      this.configManager,
    );
    if (!translationKey) return null;

    const supportedLocales = await this.configManager.getSupportedLocales(
      document.uri,
    );
    const existingLocales = supportedLocales.filter((l) => l.exists);
    if (existingLocales.length === 0) return null;
    const uniqueExistingLocales = Array.from(
      new Map(existingLocales.map((l) => [l.locale, l])).values(),
    );

    const links = uniqueExistingLocales.map((locale) => {
      const args = encodeURIComponent(
        JSON.stringify([
          translationKey,
          locale.locale,
          document.uri.toString(),
        ]),
      );
      return `[Go to ${formatLocaleName(
        locale.locale,
      )}](command:i18nBoost.navigateToLocaleKey?${args})`;
    });

    const hoverContent = new MarkdownString(links.join(" | "));
    hoverContent.isTrusted = true;
    return new Hover(hoverContent);
  }

  private async isLocaleFile(document: TextDocument): Promise<boolean> {
    if (document.languageId !== "json" && document.languageId !== "jsonc")
      return false;

    // Use cached roots from ConfigManager to avoid re-discovery overhead
    const roots = await this.configManager.getLocaleRoots();
    const docPath = document.uri.fsPath;
    return roots.some((root) => docPath.startsWith(root.path));
  }

  private async extractCurrentLocale(document: TextDocument): Promise<string> {
    const fileName = basename(document.uri.fsPath);
    const fileNamingPattern = await this.configManager.getFileNamingPattern();
    if (fileNamingPattern === "locale.json") {
      return fileName.replace(".json", "");
    } else {
      const roots = await this.configManager.getLocaleRoots();
      const docPath = document.uri.fsPath;

      const matchingRoot = [...roots]
        .sort((a, b) => b.path.length - a.path.length)
        .find((root) => docPath.startsWith(root.path));

      if (matchingRoot) {
        // relative path from root
        // root: /path/to/locales
        // doc:  /path/to/locales/en/common.json
        // rel:  en/common.json
        const normalizedRoot = normalize(matchingRoot.path);
        const normalizedDoc = normalize(docPath);
        let relativePath = normalizedDoc.substring(normalizedRoot.length);

        if (relativePath.startsWith(sep))
          relativePath = relativePath.substring(sep.length);

        const parts = relativePath.split(sep).filter((p) => p);
        if (parts.length > 0) return parts[0];
      }
    }
    return "en";
  }

  /**
   * Extract the file prefix that should be prepended to keys
   */
  private async extractFilePrefix(document: TextDocument): Promise<string> {
    const fileNamingPattern = await this.configManager.getFileNamingPattern();
    const keyStrategy = await this.configManager.getKeyStrategy();

    if (fileNamingPattern === "locale.json" || keyStrategy === "flat") {
      return "";
    }

    const roots = await this.configManager.getLocaleRoots();
    const docPath = document.uri.fsPath;

    // Find the longest matching root
    const matchingRoot = [...roots]
      .sort((a, b) => b.path.length - a.path.length)
      .find((root) => docPath.startsWith(root.path));

    if (!matchingRoot) return "";

    const normalizedDoc = normalize(docPath);
    const normalizedRoot = normalize(matchingRoot.path);

    let relativePath = normalizedDoc.substring(normalizedRoot.length);
    if (relativePath.startsWith(sep))
      relativePath = relativePath.substring(sep.length);

    const pathParts = relativePath.split(sep);

    // First part is locale (en)
    if (pathParts.length > 0) {
      pathParts.shift();
    }

    if (pathParts.length === 0) return "";

    const prefixParts: string[] = [];
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      // Last part is the filename
      if (i === pathParts.length - 1) {
        const filename = part.replace(".json", "");
        if (filename !== "common" && filename !== "index") {
          prefixParts.push(filename);
        }
      } else {
        prefixParts.push(part);
      }
    }

    return prefixParts.join(".");
  }
}

export function registerHoverProvider(
  configManager: ConfigManager,
): Disposable {
  const jsonProvider = languages.registerHoverProvider(
    { language: "json", scheme: "file" },
    new I18nHoverProvider(configManager),
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
    new I18nHoverProvider(configManager),
  );

  return Disposable.from(jsonProvider, codeProvider);
}
