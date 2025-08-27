import * as vscode from "vscode";
import { registerCopyFullKeyCommand } from "./commands/copyKey";
import { registerCreateConfigCommand } from "./commands/createConfig";
import { registerShowLocalesCommand } from "./commands/showLocales";
import { registerSelectLocaleCommand } from "./commands/selectLocale";
import { ConfigManager } from "./utils/configManager";
import { I18nNavigationProvider } from "./providers/navigation";
import { I18nCompletionProvider } from "./providers/completion";
import { I18nUnusedKeysDiagnostics } from "./providers/unusedKeys";

export function activate(context: vscode.ExtensionContext) {
  // Extension activated

  // Initialize config manager and navigation provider
  const configManager = new ConfigManager();
  const navigationProvider = new I18nNavigationProvider(configManager);
  const completionProvider = new I18nCompletionProvider(configManager);
  const completionTrigger: string[] = ["'", '"', "."];
  const unusedKeysDiagnostics = new I18nUnusedKeysDiagnostics(configManager);

  // Register definition provider for Ctrl+Click navigation
  const selector: vscode.DocumentSelector = [
    { language: "javascript" },
    { language: "typescript" },
    { language: "javascriptreact" },
    { language: "typescriptreact" },
    { language: "vue" },
    { language: "svelte" },
  ];

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(selector, navigationProvider)
  );

  // Register commands
  context.subscriptions.push(registerCopyFullKeyCommand());
  context.subscriptions.push(registerCreateConfigCommand());
  context.subscriptions.push(registerShowLocalesCommand(configManager));
  context.subscriptions.push(
    registerSelectLocaleCommand(configManager, navigationProvider)
  );
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selector,
      completionProvider,
      ...completionTrigger
    )
  );

  // Register unused keys diagnostics
  unusedKeysDiagnostics.register(context);

  // Show welcome message if no config exists (after a delay to avoid startup noise)
  setTimeout(async () => {
    const hasConfig = await configManager.hasConfig();
    if (!hasConfig) {
      const result = await vscode.window.showInformationMessage(
        "I18n Boost: No config file found. Would you like to create one?",
        "Create Config",
        "Later"
      );
      if (result === "Create Config") {
        await vscode.commands.executeCommand("i18nBoost.createConfig");
      }
    }
  }, 2000);

  // Watch for config file changes to reset cache
  const configWatcher = vscode.workspace.createFileSystemWatcher(
    "**/i18nBoost.config.ts"
  );
  configWatcher.onDidChange(() => configManager.resetCache());
  configWatcher.onDidCreate(() => configManager.resetCache());
  configWatcher.onDidDelete(() => configManager.resetCache());
  context.subscriptions.push(configWatcher);
}

export function deactivate() {}
