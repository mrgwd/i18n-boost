import { existsSync } from "fs";
import { ConfigManager } from "../utils/configManager";
import { findKeyInJsonFile } from "../utils/keyFinder";
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
    const defaultLocaleFile = await this.configManager.getLocaleFilePath(
      defaultLocale
    );
    if (!existsSync(defaultLocaleFile)) {
      window.showWarningMessage(
        `Default locale file not found: ${defaultLocaleFile}`
      );
      return null;
    }

    const keyPosition = await findKeyInJsonFile(
      translationKey,
      defaultLocaleFile
    );
    if (keyPosition) {
      return new Location(
        Uri.file(defaultLocaleFile),
        new Position(keyPosition.line, keyPosition.character)
      );
    }

    window.showWarningMessage(
      `Key "${translationKey}" not found in default locale file`
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
    const filePath = await this.configManager.getLocaleFilePath(locale);

    if (!existsSync(filePath)) {
      window.showWarningMessage(`Locale file not found: ${filePath}`);
      return false;
    }

    const keyPosition = await findKeyInJsonFile(translationKey, filePath);
    if (keyPosition) {
      const document = await workspace.openTextDocument(filePath);
      const editor = await window.showTextDocument(document);
      const position = new Position(keyPosition.line, keyPosition.character);
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
