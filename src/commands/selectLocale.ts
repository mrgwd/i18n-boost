import * as vscode from "vscode";
import { ConfigManager } from "../utils/configManager";
import { I18nNavigationProvider } from "../providers/navigation";

export function registerSelectLocaleCommand(
  configManager: ConfigManager,
  navigationProvider: I18nNavigationProvider
): vscode.Disposable {
  const disposable = vscode.commands.registerCommand(
    "i18nBoost.selectLocale",
    async () => {
      await selectLocaleAndNavigate(configManager, navigationProvider);
    }
  );
  return disposable;
}

async function selectLocaleAndNavigate(
  configManager: ConfigManager,
  navigationProvider: I18nNavigationProvider
) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage("No active editor");
    return;
  }

  const config = await configManager.loadConfig();
  if (!config) {
    vscode.window
      .showWarningMessage(
        "No configuration found. Please create a i18nBoost.config.ts file first.",
        "Create Config"
      )
      .then((selection) => {
        if (selection === "Create Config") {
          vscode.commands.executeCommand("i18nBoost.createConfig");
        }
      });
    return;
  }

  const position = editor.selection.active;
  const line = editor.document.lineAt(position.line).text;

  // Extract translation key from current position
  const translationKey = extractTranslationKeyAtPosition(
    line,
    position.character,
    config.functionNames
  );
  if (!translationKey) {
    vscode.window.showWarningMessage(
      "No translation key found at cursor position"
    );
    return;
  }

  // Show locale selection
  const availableLocales = await configManager.getAvailableLocales();
  const existingLocales = availableLocales.filter((locale) => locale.exists);

  if (existingLocales.length === 0) {
    vscode.window.showWarningMessage("No translation files found");
    return;
  }

  const quickPickItems = existingLocales.map((locale) => ({
    label: `$(globe) ${locale.locale.toUpperCase()}`,
    description: `Navigate to ${locale.locale} translation`,
    detail: locale.path,
    locale: locale.locale,
  }));

  // If only one locale exists, navigate directly
  if (quickPickItems.length === 1) {
    await navigationProvider.navigateToLocale(
      translationKey,
      quickPickItems[0].locale
    );
    return;
  }

  const selected = await vscode.window.showQuickPick(quickPickItems, {
    placeHolder: `Select locale for "${translationKey}"`,
  });

  if (selected) {
    await navigationProvider.navigateToLocale(translationKey, selected.locale);
  }
}

function extractTranslationKeyAtPosition(
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
        return match[1];
      }
    }
  }

  return null;
}
