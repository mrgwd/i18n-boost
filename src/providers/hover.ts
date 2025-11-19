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
import { basename, join, sep } from "path";

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
      const keyPath = getKeyPathAtPosition(text, offset);
      if (!keyPath) return null;

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
