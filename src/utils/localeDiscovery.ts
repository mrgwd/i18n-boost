import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { workspace } from "vscode";

export interface LocaleInfo {
  locale: string;
  path: string;
  exists: boolean;
}

/**
 * Dynamically discover supported locales from the filesystem
 * based on localesPath and fileNamingPattern settings
 */
export async function discoverSupportedLocales(
  localesPath: string,
  fileNamingPattern: "locale.json" | "locale/common.json" | "locale/index.json"
): Promise<LocaleInfo[]> {
  const workspaceFolders = workspace.workspaceFolders;
  if (!workspaceFolders) {
    return [];
  }

  const locales: LocaleInfo[] = [];
  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const fullLocalesPath = join(workspaceRoot, localesPath);

  // Check if the locales directory exists
  if (!existsSync(fullLocalesPath)) {
    return [];
  }

  try {
    switch (fileNamingPattern) {
      case "locale.json":
        // Pattern: en.json, fr.json, de.json, etc.
        {
          const files = readdirSync(fullLocalesPath);
          for (const file of files) {
            if (file.endsWith(".json")) {
              const locale = file.replace(".json", "");
              const filePath = join(fullLocalesPath, file);
              locales.push({
                locale,
                path: filePath,
                exists: existsSync(filePath),
              });
            }
          }
        }
        break;

      case "locale/common.json":
      case "locale/index.json":
        // Pattern: en/common.json, fr/common.json, etc.
        // or: en/index.json, fr/index.json, etc.
        {
          const subdirs = readdirSync(fullLocalesPath, {
            withFileTypes: true,
          });
          const fileName =
            fileNamingPattern === "locale/common.json"
              ? "common.json"
              : "index.json";

          for (const subdir of subdirs) {
            if (subdir.isDirectory()) {
              const locale = subdir.name;
              const filePath = join(fullLocalesPath, locale, fileName);
              locales.push({
                locale,
                path: filePath,
                exists: existsSync(filePath),
              });
            }
          }
        }
        break;
    }
  } catch (error) {
    // Silently handle errors - return partial results if any were discovered
  }

  return locales.sort((a, b) => a.locale.localeCompare(b.locale));
}

/**
 * Get the file path for a specific locale based on the naming pattern
 */
export function getLocaleFilePath(
  locale: string,
  localesPath: string,
  fileNamingPattern: "locale.json" | "locale/common.json" | "locale/index.json"
): string {
  const workspaceFolders = workspace.workspaceFolders;
  if (!workspaceFolders) {
    throw new Error("No workspace folder found");
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const fullLocalesPath = join(workspaceRoot, localesPath);

  switch (fileNamingPattern) {
    case "locale.json":
      return join(fullLocalesPath, `${locale}.json`);
    case "locale/common.json":
      return join(fullLocalesPath, locale, "common.json");
    case "locale/index.json":
      return join(fullLocalesPath, locale, "index.json");
    default:
      return join(fullLocalesPath, `${locale}.json`);
  }
}

/**
 * Check if a specific locale file exists
 */
export function localeFileExists(
  locale: string,
  localesPath: string,
  fileNamingPattern: "locale.json" | "locale/common.json" | "locale/index.json"
): boolean {
  try {
    const filePath = getLocaleFilePath(locale, localesPath, fileNamingPattern);
    return existsSync(filePath);
  } catch {
    return false;
  }
}
