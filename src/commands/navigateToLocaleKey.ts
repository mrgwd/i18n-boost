import vscode from "vscode";
import { ConfigManager } from "../utils/configManager";
import { findKeyInLocale } from "../utils/keyFinder";
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
    // Get the target locale path (file or directory)
    const targetLocalePath = await configManager.getLocaleFilePath(
      targetLocale
    );

    // Check if the target exists
    if (!existsSync(targetLocalePath)) {
      vscode.window.showWarningMessage(`Locale not found: ${targetLocalePath}`);
      return;
    }

    // Find the key position in the target locale
    const result = await findKeyInLocale(keyPath, targetLocalePath);

    if (!result) {
      vscode.window.showWarningMessage(
        `Key "${keyPath}" not found in ${targetLocale} locale`
      );
      return;
    }

    // Open the target file and navigate to the key
    const document = await vscode.workspace.openTextDocument(result.filePath);
    const editor = await vscode.window.showTextDocument(document);

    const position = new vscode.Position(
      result.position.line,
      result.position.character
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
