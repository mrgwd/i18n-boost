import * as vscode from "vscode";
import * as fs from "fs";
import { ConfigManager } from "../utils/configManager";
import { findKeyInJsonFile } from "../utils/keyFinder";
import { findBaseKey } from "../utils/findBaseKey";

export class I18nNavigationProvider implements vscode.DefinitionProvider {
  constructor(private configManager: ConfigManager) {}

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Definition | null> {
    const config = await this.configManager.loadConfig();
    if (!config || !config.enabled) {
      return null;
    }

    const line = document.lineAt(position.line).text;
    let translationKey = this.extractTranslationKey(
      line,
      position.character,
      config.functionNames
    );

    // --- Add base key logic ---
    const baseKey = findBaseKey(document, position);
    if (baseKey && translationKey && translationKey.length === 0) {
      translationKey = baseKey;
    } else if (
      baseKey &&
      translationKey &&
      !translationKey.startsWith(baseKey + ".")
    ) {
      translationKey = baseKey + "." + translationKey;
    }
    // --- End base key logic ---

    if (!translationKey) {
      return null;
    }

    // Navigate to default locale
    const defaultLocaleFile = this.configManager.getLocaleFilePath(
      config.defaultLocale,
      config
    );
    if (!fs.existsSync(defaultLocaleFile)) {
      vscode.window.showWarningMessage(
        `Default locale file not found: ${defaultLocaleFile}`
      );
      return null;
    }

    const keyPosition = await findKeyInJsonFile(
      translationKey,
      defaultLocaleFile
    );
    if (keyPosition) {
      return new vscode.Location(
        vscode.Uri.file(defaultLocaleFile),
        new vscode.Position(keyPosition.line, keyPosition.character)
      );
    }

    vscode.window.showWarningMessage(
      `Key "${translationKey}" not found in default locale file`
    );
    return null;
  }

  private extractTranslationKey(
    line: string,
    cursorChar: number,
    functionNames: string[]
  ): string | null {
    const patterns = functionNames.map(
      (name) =>
        new RegExp(
          `\\b${name.replace(".", "\\.")}\\s*\\(\\s*["'\`]([^"'\`]+)["'\`]`,
          "g"
        )
    );

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const matchStart = match.index + match[0].indexOf(match[1]);
        const matchEnd = matchStart + match[1].length;

        if (cursorChar >= matchStart && cursorChar <= matchEnd) {
          const fullKey = match[1];
          // Determine which segment the user clicked on
          return this.getClickedSegment(fullKey, cursorChar - matchStart);
        }
      }
    }

    return null;
  }

  /**
   * Determine which segment of the key the user clicked on
   * @param fullKey The complete key (e.g., "dashboard.sidebar.title")
   * @param relativeCursorPos The cursor position relative to the start of the key string
   * @returns The key up to the clicked segment (e.g., "dashboard" or "dashboard.sidebar")
   */
  private getClickedSegment(
    fullKey: string,
    relativeCursorPos: number
  ): string {
    if (relativeCursorPos <= 0) {
      return fullKey; // Clicked at the very beginning, return full key
    }

    const segments = fullKey.split(".");
    let currentPos = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentEnd = currentPos + segment.length;

      // If cursor is within this segment (including the dot separator)
      if (relativeCursorPos <= segmentEnd) {
        // Return the key up to and including this segment
        return segments.slice(0, i + 1).join(".");
      }

      // Move to next segment (accounting for the dot separator)
      currentPos = segmentEnd + 1;
    }

    // If we get here, cursor is after the last segment, return full key
    return fullKey;
  }

  /**
   * Navigate to a specific locale for the given translation key
   */
  async navigateToLocale(
    translationKey: string,
    locale: string
  ): Promise<boolean> {
    const config = await this.configManager.loadConfig();
    if (!config) return false;

    const filePath = this.configManager.getLocaleFilePath(locale, config);

    if (!fs.existsSync(filePath)) {
      vscode.window.showWarningMessage(`Locale file not found: ${filePath}`);
      return false;
    }

    const keyPosition = await findKeyInJsonFile(translationKey, filePath);
    if (keyPosition) {
      const document = await vscode.workspace.openTextDocument(filePath);
      const editor = await vscode.window.showTextDocument(document);
      const position = new vscode.Position(
        keyPosition.line,
        keyPosition.character
      );
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position));
      return true;
    }

    vscode.window.showWarningMessage(
      `Key "${translationKey}" not found in ${locale} locale`
    );
    return false;
  }
}
