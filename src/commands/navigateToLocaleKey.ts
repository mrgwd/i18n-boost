import vscode from "vscode";
import { ConfigManager } from "../utils/configManager";
import { findKeyInJsonFile } from "../utils/keyFinder";
import { existsSync } from "fs";
import { commands, Disposable } from "vscode";

export function registerNavigateToLocaleKeyCommand(
  configManager: ConfigManager
): Disposable {
  return commands.registerCommand(
    "i18nBoost.navigateToLocaleKey",
    async (keyPath: string, targetLocale: string) => {
      await navigateToLocaleKey(configManager, keyPath, targetLocale);
    }
  );
}

async function navigateToLocaleKey(
  configManager: ConfigManager,
  keyPath: string,
  targetLocale: string
): Promise<void> {
  try {
    // Get the target locale file path
    const targetFilePath = await configManager.getLocaleFilePath(targetLocale);

    // Check if the target file exists
    if (!existsSync(targetFilePath)) {
      vscode.window.showWarningMessage(
        `Locale file not found: ${targetFilePath}`
      );
      return;
    }

    // Find the key position in the target file
    const keyPosition = await findKeyInJsonFile(keyPath, targetFilePath);

    if (!keyPosition) {
      vscode.window.showWarningMessage(
        `Key "${keyPath}" not found in ${targetLocale} locale file`
      );
      return;
    }

    // Open the target file and navigate to the key
    const document = await vscode.workspace.openTextDocument(targetFilePath);
    const editor = await vscode.window.showTextDocument(document);

    const position = new vscode.Position(
      keyPosition.line,
      keyPosition.character
    );
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(
      new vscode.Range(position, position),
      vscode.TextEditorRevealType.InCenter
    );

    // Show a brief success message
    vscode.window.showInformationMessage(
      `Navigated to "${keyPath}" in ${targetLocale}`,
      { modal: false }
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to navigate to locale: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
