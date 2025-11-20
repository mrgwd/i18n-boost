import { ConfigManager } from "../utils/configManager";
import { I18nNavigationProvider } from "../providers/navigation";
import { extractTranslationKeyFromLine } from "../utils/translationKeyAtPosition";
import { commands, Disposable, window } from "vscode";

export function registerSelectLocaleCommand(
  configManager: ConfigManager,
  navigationProvider: I18nNavigationProvider
): Disposable {
  const disposable = commands.registerCommand(
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
  const editor = window.activeTextEditor;
  if (!editor) {
    window.showInformationMessage("No active editor");
    return;
  }

  const enabled = await configManager.isEnabled();
  if (!enabled) {
    window.showWarningMessage(
      "I18n Boost is disabled. Please enable it in VS Code settings."
    );
    return;
  }

  const position = editor.selection.active;
  const line = editor.document.lineAt(position.line).text;

  // Extract translation key from current position
  const functionNames = await configManager.getFunctionNames();
  const translationKey = extractTranslationKeyFromLine(
    line,
    position.character,
    functionNames
  );
  if (!translationKey) {
    window.showWarningMessage("No translation key found at cursor position");
    return;
  }

  // Show locale selection
  const availableLocales = await configManager.getSupportedLocales();
  const existingLocales = availableLocales.filter((locale) => locale.exists);

  if (existingLocales.length === 0) {
    window.showWarningMessage("No translation files found");
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

  const selected = await window.showQuickPick(quickPickItems, {
    placeHolder: `Select locale for "${translationKey}"`,
  });

  if (selected) {
    await navigationProvider.navigateToLocale(translationKey, selected.locale);
  }
}
