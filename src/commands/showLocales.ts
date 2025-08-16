import * as vscode from "vscode";
import { ConfigManager } from "../utils/configManager";

export function registerShowLocalesCommand(
  configManager: ConfigManager
): vscode.Disposable {
  const disposable = vscode.commands.registerCommand(
    "i18nBoost.showLocales",
    async () => {
      await showAvailableLocales(configManager);
    }
  );
  return disposable;
}

async function showAvailableLocales(configManager: ConfigManager) {
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

  const locales = await configManager.getAvailableLocales();

  if (locales.length === 0) {
    vscode.window.showInformationMessage("No locales configured.");
    return;
  }

  const items = locales.map(
    (locale) =>
      `${locale.exists ? "✅" : "❌"} ${locale.locale.toUpperCase()} - ${
        locale.path
      }`
  );

  const message = `Available locales:\n\n${items.join(
    "\n"
  )}\n\nLocales path: ${configManager.getLocalesPath()}`;

  vscode.window.showInformationMessage(message, { modal: true });
}
