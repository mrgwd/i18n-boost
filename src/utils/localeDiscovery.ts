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
  fileNamingPattern: "locale.json" | "locale/**/*.json"
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
    if (fileNamingPattern === "locale.json") {
      // Pattern: en.json, fr.json, de.json, etc.
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
    } else {
      // Pattern: locale/**/*.json (Directory based)
      // Covers: en/common.json, en/auth.json, en/auth/login.json
      const subdirs = readdirSync(fullLocalesPath, {
        withFileTypes: true,
      });

      for (const subdir of subdirs) {
        if (subdir.isDirectory()) {
          const locale = subdir.name;
          const filePath = join(fullLocalesPath, locale);

          // Check if directory has any json files or subdirectories with json files
          let exists = existsSync(filePath);
          if (exists) {
            const dirContent = readdirSync(filePath);
            exists = dirContent.some(
              (f) => f.endsWith(".json") || !f.includes(".")
            );
          }

          locales.push({
            locale,
            path: filePath,
            exists,
          });
        }
      }
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
  fileNamingPattern: "locale.json" | "locale/**/*.json"
): string {
  const workspaceFolders = workspace.workspaceFolders;
  if (!workspaceFolders) {
    throw new Error("No workspace folder found");
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const fullLocalesPath = join(workspaceRoot, localesPath);

  if (fileNamingPattern === "locale.json") {
    return join(fullLocalesPath, `${locale}.json`);
  } else {
    // locale/**/*.json
    return join(fullLocalesPath, locale);
  }
}
/**
 * Detect the file naming pattern used in the locales directory
 */
export function detectFileNamingPattern(
  localesPath: string
): "locale.json" | "locale/**/*.json" {
  const workspaceFolders = workspace.workspaceFolders;
  if (!workspaceFolders) {
    return "locale.json"; // Default fallback
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const fullLocalesPath = join(workspaceRoot, localesPath);

  if (!existsSync(fullLocalesPath)) {
    return "locale.json";
  }

  const items = readdirSync(fullLocalesPath, { withFileTypes: true });

  // Check for single file pattern (en.json, ar.json)
  const hasJsonFiles = items.some(
    (item) => item.isFile() && item.name.endsWith(".json")
  );
  if (hasJsonFiles) {
    return "locale.json";
  }

  // If we have directories, default to directory mode
  const hasDirs = items.some((item) => item.isDirectory());
  if (hasDirs) {
    return "locale/**/*.json";
  }

  return "locale.json";
}
