import vscode, { ExtensionContext } from "vscode";
import { registerCopyFullKeyCommand } from "./commands/copyKey";
import { registerShowLocalesCommand } from "./commands/showLocales";
import { registerSelectLocaleCommand } from "./commands/selectLocale";
import { registerNavigateToLocaleKeyCommand } from "./commands/navigateToLocaleKey";
import { ConfigManager } from "./utils/configManager";
import { I18nNavigationProvider } from "./providers/navigation";
import { I18nCompletionProvider } from "./providers/completion";
import { I18nUnusedKeysDiagnostics } from "./providers/unusedKeys";
import { registerHoverProvider } from "./providers/hover";
import { selector } from "./utils/constants";

export function activate(context: ExtensionContext) {
  const configManager = new ConfigManager();
  const navigationProvider = new I18nNavigationProvider(configManager);
  const completionProvider = new I18nCompletionProvider(configManager);
  const completionTrigger: string[] = ["'", '"', "."];
  const unusedKeysDiagnostics = new I18nUnusedKeysDiagnostics(configManager);

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(selector, navigationProvider)
  );

  context.subscriptions.push(registerCopyFullKeyCommand(configManager));
  context.subscriptions.push(registerShowLocalesCommand(configManager));
  context.subscriptions.push(
    registerSelectLocaleCommand(configManager, navigationProvider)
  );
  context.subscriptions.push(registerNavigateToLocaleKeyCommand(configManager));
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selector,
      completionProvider,
      ...completionTrigger
    )
  );

  context.subscriptions.push(registerHoverProvider(configManager));

  unusedKeysDiagnostics.register(context);

  context.subscriptions.push(configManager.setupConfigurationWatcher());
}

export function deactivate() {}
