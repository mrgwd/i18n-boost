import { existsSync } from "fs";
import { ConfigManager } from "../utils/configManager";
import { findKeyInLocale } from "../utils/keyFinder";
import { getTranslationKeyAtPosition } from "../utils/translationKeyAtPosition";
import {
  DefinitionProvider,
  Location,
  Position,
  TextDocument,
  workspace,
  window,
  Uri,
  Selection,
  Range,
} from "vscode";

export class I18nNavigationProvider implements DefinitionProvider {
  constructor(private configManager: ConfigManager) {}

  async provideDefinition(
    document: TextDocument,
    position: Position
  ): Promise<Location | null> {
    const enabled = await this.configManager.isEnabled();
    if (!enabled) {
      return null;
    }
    const translationKey = await getTranslationKeyAtPosition(
      document,
      position,
      this.configManager
    );

    if (!translationKey) {
      return null;
    }

    // Navigate to default locale
    const defaultLocale = await this.configManager.getDefaultLocale();
    const defaultLocalePath = await this.configManager.getLocaleFilePath(
      defaultLocale
    );

    // Check if locale path exists (file or directory)
    if (!existsSync(defaultLocalePath)) {
      window.showWarningMessage(
        `Default locale not found: ${defaultLocalePath}`
      );
      return null;
    }

    const result = await findKeyInLocale(translationKey, defaultLocalePath);

    if (result) {
      return new Location(
        Uri.file(result.filePath),
        new Position(result.position.line, result.position.character)
      );
    }

    window.showWarningMessage(
      `Key "${translationKey}" not found in default locale`
    );
    return null;
  }

  /**
   * Navigate to a specific locale for the given translation key
   */
  async navigateToLocale(
    translationKey: string,
    locale: string
  ): Promise<boolean> {
    const localePath = await this.configManager.getLocaleFilePath(locale);

    if (!existsSync(localePath)) {
      window.showWarningMessage(`Locale not found: ${localePath}`);
      return false;
    }

    const result = await findKeyInLocale(translationKey, localePath);
    if (result) {
      const document = await workspace.openTextDocument(result.filePath);
      const editor = await window.showTextDocument(document);
      const position = new Position(
        result.position.line,
        result.position.character
      );
      editor.selection = new Selection(position, position);
      editor.revealRange(new Range(position, position));
      return true;
    }

    window.showWarningMessage(
      `Key "${translationKey}" not found in ${locale} locale`
    );
    return false;
  }
}
