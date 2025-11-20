import { getKeyPathAtPosition } from "../utils/jsonWalker";
import { commands, Disposable, env, window } from "vscode";

export function registerCopyFullKeyCommand(): Disposable {
  const disposable = commands.registerCommand(
    "i18nBoost.copyFullKey",
    async () => {
      const editor = window.activeTextEditor;
      if (!editor) {
        window.showInformationMessage("No active editor");
        return;
      }

      const doc = editor.document;
      // Only JSON files for this feature
      if (doc.languageId !== "json" && doc.languageId !== "jsonc") {
        window.showInformationMessage(
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
          window.showWarningMessage(
            "Could not determine translation key at cursor"
          );
          return;
        }

        await env.clipboard.writeText(keyPath);
        window.showInformationMessage(`Copied translation key: ${keyPath}`);
      } catch (err) {
        window.showErrorMessage("i18n-boost: Failed to copy key");
      }
    }
  );

  return disposable;
}
