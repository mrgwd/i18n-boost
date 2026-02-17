import { ConfigManager } from "../utils/configManager";
import { commands, Disposable, window } from "vscode";

export function registerShowLocalesCommand(
  configManager: ConfigManager,
): Disposable {
  const disposable = commands.registerCommand(
    "i18nBoost.showLocales",
    async () => {
      await showAvailableLocales(configManager);
    },
  );
  return disposable;
}

async function showAvailableLocales(configManager: ConfigManager) {
  const enabled = await configManager.isEnabled();
  if (!enabled) {
    window.showWarningMessage(
      "I18n Boost is disabled. Please enable it in VS Code settings.",
    );
    return;
  }

  const locales = await configManager.getSupportedLocales();

  if (locales.length === 0) {
    window.showInformationMessage("No locales configured.");
    return;
  }

  const items = locales.map(
    (locale) =>
      `${locale.exists ? "✅" : "❌"} ${locale.locale.toUpperCase()} - ${
        locale.path
      }`,
  );

  const localesPaths = await configManager.getLocalesPaths();
  const message = `Available locales:\n\n${items.join(
    "\n",
  )}\n\nLocales paths: ${localesPaths.join(", ")}`;

  window.showInformationMessage(message, { modal: true });
}
