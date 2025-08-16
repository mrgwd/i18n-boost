import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

const CONFIG_FILE_NAME = "i18nBoost.config.ts";

export function registerCreateConfigCommand(): vscode.Disposable {
  const disposable = vscode.commands.registerCommand(
    "i18nBoost.createConfig",
    async () => {
      await createConfigFile();
    }
  );
  return disposable;
}

async function createConfigFile() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("No workspace folder found");
    return;
  }

  const configTemplate = `// I18n Boost Configuration
export default {
    // Path to your translation files folder (relative to workspace root)
    localesPath: 'src/i18n',
    
    // Default locale to navigate to on Ctrl+Click
    defaultLocale: 'en',
    
    // All supported locales in your project
    supportedLocales: ['en', 'ar', 'fr', 'es', 'de'],
    
    // Function names that indicate translation keys
    functionNames: ['t', 'translate', '$t', 'i18n.t'],
    
    // File naming pattern for your locale files
    // Options: 'locale.json', 'locale/common.json', 'locale/index.json'
    fileNamingPattern: 'locale.json',
    
    // Enable/disable the extension features
    enabled: true
};`;

  const configPath = path.join(
    workspaceFolders[0].uri.fsPath,
    CONFIG_FILE_NAME
  );

  if (fs.existsSync(configPath)) {
    const overwrite = await vscode.window.showWarningMessage(
      "Config file already exists. Overwrite?",
      "Overwrite",
      "Cancel"
    );
    if (overwrite !== "Overwrite") return;
  }

  try {
    fs.writeFileSync(configPath, configTemplate);
    vscode.window.showInformationMessage(
      "I18n Boost config file created successfully!"
    );

    // Open the config file
    const document = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(document);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create config file: ${error}`);
  }
}
