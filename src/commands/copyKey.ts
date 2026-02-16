import { getKeyPathAtPosition } from "../utils/jsonWalker";
import { commands, Disposable, env, window, workspace } from "vscode";
import { ConfigManager } from "../utils/configManager";
import { normalize, sep } from "path";
import { discoverLocaleRoots } from "../utils/localeDiscovery";

export function registerCopyFullKeyCommand(
  configManager: ConfigManager,
): Disposable {
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
          "Copy translation key: open a JSON file and place the cursor on a value or key",
        );
        return;
      }

      const position = editor.selection.active;
      try {
        let keyPath = getKeyPathAtPosition(
          doc.getText(),
          doc.offsetAt(position),
        );
        if (!keyPath) {
          window.showWarningMessage(
            "Could not determine translation key at cursor",
          );
          return;
        }

        // Add file prefix if needed
        const prefix = await extractFilePrefix(doc, configManager);
        if (prefix) {
          keyPath = `${prefix}.${keyPath}`;
        }

        await env.clipboard.writeText(keyPath);
        window.showInformationMessage(`Copied translation key: ${keyPath}`);
      } catch (err) {
        window.showErrorMessage("i18n-boost: Failed to copy key");
      }
    },
  );

  return disposable;
}

async function extractFilePrefix(
  document: import("vscode").TextDocument,
  configManager: ConfigManager,
): Promise<string> {
  const fileNamingPattern = await configManager.getFileNamingPattern();
  const keyStrategy = await configManager.getKeyStrategy();

  // Case 1: Flat structure (en.json, ar.json) - no prefix
  // OR keyStrategy is "flat" - no prefix
  if (fileNamingPattern === "locale.json" || keyStrategy === "flat") {
    return "";
  }

  // Cases 2, 3, 4: Directory-based structure
  const wsFolders = workspace.workspaceFolders;
  if (!wsFolders || wsFolders.length === 0) return "";

  const localesPaths = await configManager.getLocalesPaths();
  const roots = await discoverLocaleRoots(localesPaths);

  const docFsPath = document.uri.fsPath;
  // Find which root this file belongs to
  const matchingRoot = roots
    .sort((a, b) => b.path.length - a.path.length)
    .find((root) => docFsPath.startsWith(root.path));

  if (!matchingRoot) return "";

  const normalizedDoc = normalize(docFsPath);
  const normalizedRoot = normalize(matchingRoot.path);

  if (!normalizedDoc.startsWith(normalizedRoot)) {
    return "";
  }

  // Get relative path from locales folder
  // relative path should handle sep correctly
  let relativePath = normalizedDoc.substring(normalizedRoot.length);
  if (relativePath.startsWith(sep))
    relativePath = relativePath.substring(sep.length);

  const pathParts = relativePath.split(sep);

  // Remove locale name (first part, e.g., "en", "ar")
  if (pathParts.length > 0) {
    pathParts.shift();
  }

  // If no parts left, it's Case 2 (single file in locale folder)
  if (pathParts.length === 0) {
    return "";
  }

  // Build prefix from remaining parts
  const prefixParts: string[] = [];

  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];

    // Last part is the filename
    if (i === pathParts.length - 1) {
      const filename = part.replace(".json", "");
      // Skip common.json and index.json as they don't add to the key prefix
      if (filename !== "common" && filename !== "index") {
        prefixParts.push(filename);
      }
    } else {
      // Folder names are always part of the prefix
      prefixParts.push(part);
    }
  }

  return prefixParts.join(".");
}
