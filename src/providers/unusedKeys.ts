import { parseTree, ParseError, Node as JsonNode } from "jsonc-parser";
import { ConfigManager } from "../utils/configManager";
import {
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
  DiagnosticTag,
  ExtensionContext,
  languages,
  Range,
  RelativePattern,
  TextDocument,
  Uri,
  workspace,
} from "vscode";
import { extname, join, normalize, sep } from "path";

type KeyWithRange = {
  keyPath: string;
  range: Range;
  isLeaf: boolean;
};

/**
 * Provides diagnostics that mark unused i18n keys in locale JSON files.
 * Unused keys are tagged as Unnecessary so they appear dimmed in the editor.
 */
export class I18nUnusedKeysDiagnostics {
  private diagnostics: DiagnosticCollection;
  private usedKeysCache: Set<string> = new Set();
  private recomputeTimer: ReturnType<typeof setTimeout> | null = null;
  private isComputing = false;

  constructor(private readonly configManager: ConfigManager) {
    this.diagnostics = languages.createDiagnosticCollection(
      "i18n-boost-unused-keys"
    );
  }

  register(context: ExtensionContext) {
    context.subscriptions.push(this.diagnostics);

    // Initial population (schedule, don't block activation)
    this.scheduleRecompute(300);

    // Recompute when code files are saved (not on each keystroke)
    context.subscriptions.push(
      workspace.onDidSaveTextDocument((doc) => {
        if (this.isCodeFile(doc)) this.scheduleRecompute();
      })
    );

    // Refresh diagnostics when a locale file opens or changes
    context.subscriptions.push(
      workspace.onDidOpenTextDocument((doc) => this.refreshFor(doc))
    );
    context.subscriptions.push(
      workspace.onDidChangeTextDocument((e) => this.refreshFor(e.document))
    );
    context.subscriptions.push(
      workspace.onDidSaveTextDocument((doc) => this.refreshFor(doc))
    );

    // Config changes
    context.subscriptions.push(
      workspace.onDidChangeConfiguration(() => this.scheduleRecompute())
    );

    // File system watcher for locale directory
    (async () => {
      const localesGlob = await this.getLocalesGlob();
      if (!localesGlob) return;
      const watcher = workspace.createFileSystemWatcher(localesGlob);
      watcher.onDidCreate((uri) => this.refreshOpenDocForUri(uri));
      watcher.onDidChange((uri) => this.refreshOpenDocForUri(uri));
      watcher.onDidDelete((uri) => this.diagnostics.delete(uri));
      context.subscriptions.push(watcher);
    })();

    // Refresh all currently open locale documents on activation
    for (const doc of workspace.textDocuments) {
      this.refreshFor(doc);
    }
  }

  private isCodeFile(doc: TextDocument): boolean {
    const ext = extname(doc.uri.fsPath).toLowerCase();
    return [".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte", ".html"].includes(
      ext
    );
  }

  private scheduleRecompute(delayMs: number = 800) {
    if (this.recomputeTimer) clearTimeout(this.recomputeTimer);
    this.recomputeTimer = setTimeout(
      () => this.recomputeUsedKeysAndRefresh(),
      delayMs
    );
  }

  private async recomputeUsedKeysAndRefresh() {
    // Clear the timer to prevent race conditions
    this.recomputeTimer = null;
    await this.computeUsedKeys();
    for (const doc of workspace.textDocuments) {
      this.refreshFor(doc);
    }
  }

  private async refreshOpenDocForUri(uri: Uri) {
    const doc = workspace.textDocuments.find(
      (d) => d.uri.toString() === uri.toString()
    );
    if (doc) this.refreshFor(doc);
  }

  private async refreshFor(document: TextDocument) {
    const enabled = await this.configManager.isEnabled();
    if (!enabled) {
      this.diagnostics.clear();
      return;
    }

    if (!(await this.isLocaleDocument(document))) {
      return;
    }

    const diagnostics: Diagnostic[] = [];
    const keys = this.collectKeysWithRanges(document);

    // Get file prefix for multi-file structures (Cases 3 & 4)
    const filePrefix = await this.extractFilePrefix(document);

    for (const k of keys) {
      if (!k.isLeaf) continue;

      // Build the full key path including file prefix if applicable
      const fullKeyPath = filePrefix ? `${filePrefix}.${k.keyPath}` : k.keyPath;
      if (this.usedKeysCache.has(fullKeyPath)) continue;

      const diag = new Diagnostic(
        k.range,
        `Unused i18n key: ${fullKeyPath}`,
        DiagnosticSeverity.Hint
      );
      diag.tags = [DiagnosticTag.Unnecessary];
      diagnostics.push(diag);
    }

    this.diagnostics.set(document.uri, diagnostics);
  }

  private async isLocaleDocument(document: TextDocument): Promise<boolean> {
    if (document.languageId !== "json" && document.languageId !== "jsonc") {
      return false;
    }
    const localesPath = await this.configManager.getLocalesPath();
    if (!localesPath) return false;

    const wsFolders = workspace.workspaceFolders;
    if (!wsFolders || wsFolders.length === 0) return false;
    const workspaceRoot = wsFolders[0].uri.fsPath;
    const fullLocalesPath = join(workspaceRoot, localesPath);

    const docFsPath = document.uri.fsPath;
    const normalizedDoc = normalize(docFsPath);
    const normalizedLocales = normalize(fullLocalesPath) + sep;
    return normalizedDoc.startsWith(normalizedLocales);
  }

  private async getLocalesGlob(): Promise<string | null> {
    const localesPath = await this.configManager.getLocalesPath();
    if (!localesPath) return null;
    const fileNamingPattern = await this.configManager.getFileNamingPattern();
    const relBase = this.toWorkspaceRelativeGlob(localesPath);

    switch (fileNamingPattern) {
      case "locale.json":
        return new RelativePattern(relBase, "*.json").pattern;
      default:
        return new RelativePattern(relBase, "**/*.json").pattern;
    }
  }

  private toWorkspaceRelativeGlob(absPath: string): string {
    return absPath;
  }

  private collectKeysWithRanges(document: TextDocument): KeyWithRange[] {
    const text = document.getText();
    const errors: ParseError[] = [];
    const root = parseTree(text, errors, { allowTrailingComma: true });
    if (!root || errors.length > 0) return [];

    const results: KeyWithRange[] = [];

    const walk = (node: JsonNode, pathParts: string[]) => {
      if (node.type === "object" && node.children) {
        for (const prop of node.children) {
          if (!prop.children || prop.children.length < 2) continue;
          const keyNode = prop.children[0];
          const valueNode = prop.children[1];

          const keyText = this.extractStringFromQuoted(
            text,
            keyNode.offset,
            keyNode.length
          );
          const newPath = [...pathParts, keyText];
          const keyPath = newPath.join(".");

          const range = this.keyNameRange(document, keyNode);

          const isLeaf =
            valueNode.type !== "object" && valueNode.type !== "array";
          results.push({ keyPath, range, isLeaf });

          // Recurse into objects
          if (valueNode.type === "object") {
            walk(valueNode, newPath);
          }
        }
      }
    };

    walk(root, []);
    return results;
  }

  private keyNameRange(document: TextDocument, keyNode: JsonNode): Range {
    // keyNode includes surrounding quotes. Highlight only the name inside quotes.
    const start = document.positionAt(keyNode.offset + 1);
    const end = document.positionAt(keyNode.offset + keyNode.length - 1);
    return new Range(start, end);
  }

  private extractStringFromQuoted(
    source: string,
    offset: number,
    length: number
  ): string {
    const raw = source.substring(offset, offset + length);
    if (raw.length >= 2 && (raw.startsWith('"') || raw.startsWith("'"))) {
      return raw.substring(1, raw.length - 1);
    }
    return raw;
  }

  /**
   * Extract the file prefix that should be prepended to keys
   * For multi-file structures (Cases 3 & 4), the filename/folder path is part of the key
   *
   * Examples:
   * - en/errors.json -> "errors"
   * - en/auth/login.json -> "auth.login"
   * - en/common.json -> "" (special case, no prefix)
   * - en/index.json -> "" (special case, no prefix)
   * - en.json -> "" (flat structure, no prefix)
   */
  private async extractFilePrefix(document: TextDocument): Promise<string> {
    const fileNamingPattern = await this.configManager.getFileNamingPattern();
    const keyStrategy = await this.configManager.getKeyStrategy();

    // Case 1: Flat structure (en.json, ar.json) - no prefix
    // OR keyStrategy is "flat" - no prefix
    if (fileNamingPattern === "locale.json" || keyStrategy === "flat") {
      return "";
    }

    // Cases 2, 3, 4: Directory-based structure
    const wsFolders = workspace.workspaceFolders;
    if (!wsFolders || wsFolders.length === 0) return "";

    const workspaceRoot = wsFolders[0].uri.fsPath;
    const localesPath = await this.configManager.getLocalesPath();
    const fullLocalesPath = join(workspaceRoot, localesPath);

    const docFsPath = document.uri.fsPath;
    const normalizedDoc = normalize(docFsPath);
    const normalizedLocales = normalize(fullLocalesPath) + sep;

    if (!normalizedDoc.startsWith(normalizedLocales)) {
      return "";
    }

    // Get relative path from locales folder
    const relativePath = normalizedDoc.substring(normalizedLocales.length);
    const pathParts = relativePath.split(sep);

    // Remove locale name (first part, e.g., "en", "ar")
    if (pathParts.length > 0) {
      pathParts.shift();
    }

    // If no parts left, it's Case 2 (single file in locale folder)
    if (pathParts.length === 0) {
      return "";
    }

    // Build prefix from remaining parts
    const prefixParts: string[] = [];

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];

      // Last part is the filename
      if (i === pathParts.length - 1) {
        const filename = part.replace(".json", "");
        // Skip common.json and index.json as they don't add to the key prefix
        if (filename !== "common" && filename !== "index") {
          prefixParts.push(filename);
        }
      } else {
        // Folder names are always part of the prefix
        prefixParts.push(part);
      }
    }

    return prefixParts.join(".");
  }

  /**
   * Strip comments from source code to avoid counting commented translation keys as "used"
   * Handles:
   * - Single-line comments: // ...
   * - Multi-line comments: /* ... *\/
   * - JSX comments: {/* ... *\/}
   * - HTML comments: <!-- ... -->
   *
   * Note: This is a best-effort approach using regex. It covers 95%+ of cases
   * but may have edge cases with strings containing comment-like patterns.
   */
  private stripComments(code: string): string {
    let result = code;

    // Step 1: Remove multi-line comments /* ... */ and JSX comments {/* ... */}
    // This regex handles nested braces and preserves strings
    result = result.replace(/\/\*[\s\S]*?\*\//gm, (match) => {
      // Preserve newlines to maintain line structure for better debugging
      return match.replace(/[^\n]/g, " ");
    });

    // Step 2: Remove single-line comments // ...
    // But preserve URLs (http://, https://) and comment-like patterns in strings
    result = result.replace(/^(\s*)\/\/.*$/gm, (match, indent) => {
      // Preserve the indentation and newline
      return indent;
    });

    // Step 3: Remove JSX-style comments {/* ... */} that might remain
    result = result.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/gm, (match) => {
      return match.replace(/[^\n]/g, " ");
    });

    // Step 4: Remove HTML comments <!-- ... -->
    result = result.replace(/<!--[\s\S]*?-->/gm, (match) => {
      return match.replace(/[^\n]/g, " ");
    });
    return result;
  }

  private async computeUsedKeys() {
    if (this.isComputing) return;
    this.isComputing = true;
    try {
      const enabled = await this.configManager.isEnabled();
      if (!enabled) {
        this.usedKeysCache = new Set();
        return;
      }

      const functionNames = await this.configManager.getFunctionNames();
      const includeGlob = "**/*.{ts,tsx,js,jsx,vue,svelte,html}";
      const excludeGlob = "**/node_modules/**";

      const files = await workspace.findFiles(includeGlob, excludeGlob);

      const used: Set<string> = new Set();
      const relCallPattern = new RegExp(
        "(?:^|[^A-Za-z0-9_])(?:" +
          functionNames.map((n) => n.replace(/\./g, "\\.")).join("|") +
          ")\\s*\\(\\s*[\"'`]([^\"'`]+)[\"'`]",
        "gm"
      );
      const baseKeyRegex = /useTranslations?\s*\(\s*[\"'`]([^\"'`]+)[\"'`]/gm;

      for (const uri of files) {
        try {
          const bytes = await workspace.fs.readFile(uri);
          let text = Buffer.from(bytes).toString("utf8");

          // Strip comments to avoid counting commented translation keys as "used"
          text = this.stripComments(text);

          const baseKeys = new Set<string>();
          let bm: RegExpExecArray | null;
          while ((bm = baseKeyRegex.exec(text)) !== null) {
            if (bm[1]) baseKeys.add(bm[1]);
          }

          let m: RegExpExecArray | null;
          while ((m = relCallPattern.exec(text)) !== null) {
            const raw = m[1];
            if (!raw) continue;
            used.add(raw);
            for (const base of baseKeys) {
              if (!raw.startsWith(base + ".")) used.add(`${base}.${raw}`);
            }
          }
        } catch {
          // ignore file read issues
        }
      }

      // Replace the cache with the newly computed set of used keys
      // This ensures keys that are no longer used will be properly flagged as unused
      this.usedKeysCache = used;
    } finally {
      this.isComputing = false;
    }
  }
}
