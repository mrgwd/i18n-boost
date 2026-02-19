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
    position: Position,
  ): Promise<Location | null> {
    const enabled = await this.configManager.isEnabled();
    if (!enabled) {
      return null;
    }
    const translationKey = await getTranslationKeyAtPosition(
      document,
      position,
      this.configManager,
    );

    if (!translationKey) {
      return null;
    }

    // Navigate to default locale
    const defaultLocale = await this.configManager.getDefaultLocale();
    const defaultLocalePaths = await this.configManager.getLocaleFilePaths(
      defaultLocale,
      document.uri,
    );
    const keyStrategy = await this.configManager.getKeyStrategy();

    // Iterate through all paths
    for (const localePath of defaultLocalePaths) {
      if (!existsSync(localePath)) continue;

      const result = await findKeyInLocale(
        translationKey,
        localePath,
        keyStrategy,
      );

      if (result) {
        return new Location(
          Uri.file(result.filePath),
          new Position(result.position.line, result.position.character),
        );
      }
    }

    return null;
  }

  /**
   * Navigate to a specific locale for the given translation key
   */
  async navigateToLocale(
    translationKey: string,
    locale: string,
    contextUri?: Uri,
  ): Promise<boolean> {
    const localePaths = await this.configManager.getLocaleFilePaths(
      locale,
      contextUri,
    );
    const keyStrategy = await this.configManager.getKeyStrategy();

    // Iterate
    for (const localePath of localePaths) {
      if (!existsSync(localePath)) continue;

      const result = await findKeyInLocale(
        translationKey,
        localePath,
        keyStrategy,
      );
      if (result) {
        const document = await workspace.openTextDocument(result.filePath);
        const editor = await window.showTextDocument(document);
        const position = new Position(
          result.position.line,
          result.position.character,
        );
        editor.selection = new Selection(position, position);
        editor.revealRange(new Range(position, position));
        return true;
      }
    }

    window.showWarningMessage(
      `Key "${translationKey}" not found in ${locale} locale`,
    );
    return false;
  }
}
