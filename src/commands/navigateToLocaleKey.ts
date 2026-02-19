import vscode from "vscode";
import { ConfigManager } from "../utils/configManager";
import { findKeyInLocale } from "../utils/keyFinder";
import { existsSync } from "fs";
import { commands, Disposable, Uri } from "vscode";

export function registerNavigateToLocaleKeyCommand(
  configManager: ConfigManager,
): Disposable {
  return commands.registerCommand(
    "i18nBoost.navigateToLocaleKey",
    async (keyPath: string, targetLocale: string, contextUriStr?: string) => {
      await navigateToLocaleKey(
        configManager,
        keyPath,
        targetLocale,
        contextUriStr,
      );
    },
  );
}

async function navigateToLocaleKey(
  configManager: ConfigManager,
  keyPath: string,
  targetLocale: string,
  contextUriStr?: string,
): Promise<void> {
  try {
    let contextUri: Uri | undefined;
    if (contextUriStr) {
      try {
        contextUri = Uri.parse(contextUriStr);
      } catch (e) {
        console.warn("Invalid context URI", contextUriStr);
      }
    }

    // Get all potential target locale paths (context-aware)
    const targetLocalePaths = await configManager.getLocaleFilePaths(
      targetLocale,
      contextUri,
    );

    if (targetLocalePaths.length === 0) {
      vscode.window.showWarningMessage(`Locale "${targetLocale}" not found.`);
      return;
    }

    const keyStrategy = await configManager.getKeyStrategy();

    // Iterate through all paths to find where the key is defined
    for (const localePath of targetLocalePaths) {
      if (!existsSync(localePath)) continue;

      const result = await findKeyInLocale(keyPath, localePath, keyStrategy);

      if (result) {
        // Found it! Open and navigate.
        const document = await vscode.workspace.openTextDocument(
          result.filePath,
        );
        const editor = await vscode.window.showTextDocument(document);

        const position = new vscode.Position(
          result.position.line,
          result.position.character,
        );
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter,
        );

        // Show a brief success message
        vscode.window.showInformationMessage(
          `Navigated to "${keyPath}" in ${targetLocale}`,
          { modal: false },
        );
        return;
      }
    }

    // If we're here, we checked all paths and didn't find the key
    vscode.window.showWarningMessage(
      `Key "${keyPath}" not found in ${targetLocale} locale`,
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to navigate to locale: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
