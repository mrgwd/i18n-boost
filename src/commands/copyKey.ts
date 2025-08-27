import * as vscode from "vscode";
import { getKeyPathAtPosition } from "../utils/jsonWalker";

export function registerCopyFullKeyCommand(): vscode.Disposable {
  const disposable = vscode.commands.registerCommand(
    "i18nBoost.copyFullKey",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("No active editor");
        return;
      }

      const doc = editor.document;
      // Only JSON files for this feature
      if (doc.languageId !== "json" && doc.languageId !== "jsonc") {
        vscode.window.showInformationMessage(
          "Copy translation key: open a JSON file and place the cursor on a value or key"
        );
        return;
      }

      const position = editor.selection.active;
      try {
        const keyPath = getKeyPathAtPosition(
          doc.getText(),
          doc.offsetAt(position)
        );
        if (!keyPath) {
          vscode.window.showWarningMessage(
            "Could not determine translation key at cursor"
          );
          return;
        }

        await vscode.env.clipboard.writeText(keyPath);
        vscode.window.showInformationMessage(
          `Copied translation key: ${keyPath}`
        );
      } catch (err) {
        vscode.window.showErrorMessage("i18n-boost: Failed to copy key");
      }
    }
  );

  return disposable;
}
