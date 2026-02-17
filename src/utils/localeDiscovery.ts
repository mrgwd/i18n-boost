import { existsSync, readdirSync } from "fs";
import { join, isAbsolute } from "path";
import { workspace } from "vscode";

export interface LocaleInfo {
  locale: string;
  path: string;
  exists: boolean;
}

export interface LocaleRoot {
  path: string;
  sourcePatternIndex: number;
}

/**
 * Dynamically discover locale roots based on configuration patterns.
 * Handles exact paths and glob patterns (e.g. apps/*\/src/locales).
 */
export async function discoverLocaleRoots(
  localesPaths: string[],
): Promise<LocaleRoot[]> {
  const workspaceFolders = workspace.workspaceFolders;
  if (!workspaceFolders) return [];

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const roots: LocaleRoot[] = [];

  for (let i = 0; i < localesPaths.length; i++) {
    const rawPattern = localesPaths[i];

    // Check if it looks like a glob (contains *)
    if (!rawPattern.includes("*")) {
      // Static path
      const absolutePath = isAbsolute(rawPattern)
        ? rawPattern
        : join(workspaceRoot, rawPattern);

      if (existsSync(absolutePath)) {
        roots.push({
          path: absolutePath,
          sourcePatternIndex: i,
        });
      }
      continue;
    }

    // It's a glob pattern. We need to find directories that match this pattern.
    // We'll search for JSON files inside this pattern to find the roots.
    // Pattern: apps/*/src/locales -> search for apps/*/src/locales/**/*.json
    const searchPattern = `${rawPattern}/**/*.json`;

    // We use a simplified regex to extract the root part from the file path
    // Escape specific regex characters, then replace * with [^/]+
    const normalizedPattern = rawPattern.replace(/\\/g, "/");

    // Create logic to identify the root directory from a file path
    // We don't have a perfect regex for every glob, but for the structured patterns we expect:
    // apps/*/src/locales
    // The "Root" is the directory that matched the pattern.

    // Approach: use regex to match valid roots based on the pattern structure
    const regexSource = normalizedPattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape regex chars
      .replace(/\*\*/g, ".*") // ** -> .*
      .replace(/\*/g, "[^/]+"); // * -> [^/]+ (assuming forward slash)

    // The regex should match the workspace-relative path of the root
    const rootRegex = new RegExp(`^${regexSource}`);

    const foundFiles = await workspace.findFiles(
      searchPattern,
      "**/node_modules/**",
    );

    const uniqueRoots = new Set<string>();

    for (const file of foundFiles) {
      const relativePath = workspace.asRelativePath(file, false);
      const match = relativePath.match(rootRegex);

      if (match) {
        // match[0] is the part of the path that corresponds to the config pattern (the root)
        const rootOnDisk = join(workspaceRoot, match[0]);
        if (!uniqueRoots.has(rootOnDisk)) {
          uniqueRoots.add(rootOnDisk);
          roots.push({
            path: rootOnDisk,
            sourcePatternIndex: i,
          });
        }
      }
    }
  }

  return roots;
}

/**
 * Dynamically discover supported locales from the filesystem
 * based on localesPath and fileNamingPattern settings
 */
export async function discoverSupportedLocales(
  localesPaths: string[],
  fileNamingPattern: "locale.json" | "locale/**/*.json",
): Promise<LocaleInfo[]> {
  const roots = await discoverLocaleRoots(localesPaths);
  const locales: LocaleInfo[] = [];

  for (const root of roots) {
    if (!existsSync(root.path)) continue;

    try {
      if (fileNamingPattern === "locale.json") {
        // Pattern: en.json, fr.json
        const files = readdirSync(root.path);
        for (const file of files) {
          if (file.endsWith(".json")) {
            const locale = file.replace(".json", "");
            const filePath = join(root.path, file);

            locales.push({
              locale,
              path: filePath,
              exists: true,
            });
          }
        }
      } else {
        // Pattern: locale/**/*.json (Directory based)
        const subdirs = readdirSync(root.path, { withFileTypes: true });

        for (const subdir of subdirs) {
          if (subdir.isDirectory()) {
            const locale = subdir.name;
            const filePath = join(root.path, locale);

            let exists = existsSync(filePath);
            if (exists) {
              const dirContent = readdirSync(filePath);
              exists = dirContent.some(
                (f) => f.endsWith(".json") || !f.includes("."),
              );
            }

            if (exists) {
              locales.push({
                locale,
                path: filePath,
                exists,
              });
            }
          }
        }
      }
    } catch (error) {
      // Suppress errors
    }
  }

  return locales.sort((a, b) => a.locale.localeCompare(b.locale));
}

/**
 * Get the file path for a specific locale based on the naming pattern.
 * NOTE: This is a legacy/fallback method. It returns the first valid path found.
 */
export function getLocaleFilePath(
  locale: string,
  localesPaths: string[],
  fileNamingPattern: "locale.json" | "locale/**/*.json",
): string {
  const workspaceFolders = workspace.workspaceFolders;
  if (!workspaceFolders) throw new Error("No workspace folder found");
  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // Since we cannot run async discovery here and this function is expected to return a string immediately,
  // we can only robustly support static paths.
  // For glob paths, we return a best-effort constant path (first match logic) IF it was static.
  // If it is dynamic, this function is inherently limited.
  // Ideally, callers should use `configManager.getLocaleFilePath` which is async and handles context.

  const firstPath = localesPaths[0] || "src/i18n";
  // Attempt to resolve if it is static
  const fullLocalesPath = isAbsolute(firstPath)
    ? firstPath
    : join(workspaceRoot, firstPath.replace(/\*/g, ""));

  if (fileNamingPattern === "locale.json") {
    return join(fullLocalesPath, `${locale}.json`);
  } else {
    return join(fullLocalesPath, locale);
  }
}

/**
 * Detect the file naming pattern used in the locales directory
 */
export async function detectFileNamingPattern(
  localesPaths: string[],
): Promise<"locale.json" | "locale/**/*.json"> {
  const roots = await discoverLocaleRoots(localesPaths);

  for (const root of roots) {
    if (!existsSync(root.path)) continue;
    try {
      const items = readdirSync(root.path, { withFileTypes: true });
      if (items.some((item) => item.isFile() && item.name.endsWith(".json"))) {
        return "locale.json";
      }
      if (items.some((item) => item.isDirectory())) {
        return "locale/**/*.json";
      }
    } catch (e) {
      continue;
    }
  }

  return "locale.json";
}
