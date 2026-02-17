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
  // Cache of used keys PER ROOT path.
  // Map<RootPath, Set<Key>>
  private usedKeysPerRoot: Map<string, Set<string>> = new Map();
  private recomputeTimer: ReturnType<typeof setTimeout> | null = null;
  private isComputing = false;

  constructor(private readonly configManager: ConfigManager) {
    this.diagnostics = languages.createDiagnosticCollection(
      "i18n-boost-unused-keys",
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
      }),
    );

    // Refresh diagnostics when a locale file opens or changes
    context.subscriptions.push(
      workspace.onDidOpenTextDocument((doc) => this.refreshFor(doc)),
    );
    context.subscriptions.push(
      workspace.onDidChangeTextDocument((e) => this.refreshFor(e.document)),
    );
    context.subscriptions.push(
      workspace.onDidSaveTextDocument((doc) => this.refreshFor(doc)),
    );

    // Config changes
    context.subscriptions.push(
      workspace.onDidChangeConfiguration(() => this.scheduleRecompute()),
    );

    // File system watcher for locale directory
    (async () => {
      const roots = await this.configManager.getLocaleRoots();
      // Create watchers for each root
      for (const root of roots) {
        const watcher = workspace.createFileSystemWatcher(
          new RelativePattern(root.path, "**/*.json"),
        );
        watcher.onDidCreate((uri) => this.refreshOpenDocForUri(uri));
        watcher.onDidChange((uri) => this.refreshOpenDocForUri(uri));
        watcher.onDidDelete((uri) => this.diagnostics.delete(uri));
        context.subscriptions.push(watcher);
      }
    })();

    // Refresh all currently open locale documents on activation
    for (const doc of workspace.textDocuments) {
      this.refreshFor(doc);
    }
  }

  private isCodeFile(doc: TextDocument): boolean {
    const ext = extname(doc.uri.fsPath).toLowerCase();
    return [".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte", ".html"].includes(
      ext,
    );
  }

  private scheduleRecompute(delayMs: number = 800) {
    if (this.recomputeTimer) clearTimeout(this.recomputeTimer);
    this.recomputeTimer = setTimeout(
      () => this.recomputeUsedKeysAndRefresh(),
      delayMs,
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
      (d) => d.uri.toString() === uri.toString(),
    );
    if (doc) this.refreshFor(doc);
  }

  private async refreshFor(document: TextDocument) {
    const enabled = await this.configManager.isEnabled();
    if (!enabled) {
      this.diagnostics.clear();
      return;
    }

    // Determine if this is a locale document and WHICH root it belongs to
    const matchingRoot = await this.getMatchingRoot(document);

    if (!matchingRoot) {
      return;
    }

    const diagnostics: Diagnostic[] = [];
    const keys = this.collectKeysWithRanges(document);

    // Get file prefix for multi-file structures
    const filePrefix = await this.extractFilePrefix(document, matchingRoot);

    // Get used keys specifically for this root
    const usedKeys = this.usedKeysPerRoot.get(matchingRoot) || new Set();

    for (const k of keys) {
      if (!k.isLeaf) continue;

      // Build the full key path including file prefix if applicable
      const fullKeyPath = filePrefix ? `${filePrefix}.${k.keyPath}` : k.keyPath;
      if (usedKeys.has(fullKeyPath)) continue;

      const diag = new Diagnostic(
        k.range,
        `Unused i18n key: ${fullKeyPath} (in context of ${matchingRoot})`,
        DiagnosticSeverity.Hint,
      );
      diag.tags = [DiagnosticTag.Unnecessary];
      diagnostics.push(diag);
    }

    this.diagnostics.set(document.uri, diagnostics);
  }

  private async getMatchingRoot(
    document: TextDocument,
  ): Promise<string | null> {
    if (document.languageId !== "json" && document.languageId !== "jsonc") {
      return null;
    }

    const roots = await this.configManager.getLocaleRoots();
    const docPath = document.uri.fsPath;

    const match = roots
      .sort((a, b) => b.path.length - a.path.length)
      .find((r) => docPath.startsWith(r.path));
    return match ? match.path : null;
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
            keyNode.length,
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
    length: number,
  ): string {
    const raw = source.substring(offset, offset + length);
    if (raw.length >= 2 && (raw.startsWith('"') || raw.startsWith("'"))) {
      return raw.substring(1, raw.length - 1);
    }
    return raw;
  }

  /**
   * Extract the file prefix that should be prepended to keys
   */
  private async extractFilePrefix(
    document: TextDocument,
    rootPath: string,
  ): Promise<string> {
    const fileNamingPattern = await this.configManager.getFileNamingPattern();
    const keyStrategy = await this.configManager.getKeyStrategy();

    if (fileNamingPattern === "locale.json" || keyStrategy === "flat") {
      return "";
    }

    const docFsPath = document.uri.fsPath;
    const normalizedDoc = normalize(docFsPath);
    const normalizedRoot = normalize(rootPath);

    if (!normalizedDoc.startsWith(normalizedRoot)) {
      return "";
    }

    // Get relative path from locales folder
    let relativePath = normalizedDoc.substring(normalizedRoot.length);
    if (relativePath.startsWith(sep))
      relativePath = relativePath.substring(sep.length);

    const pathParts = relativePath.split(sep);

    // Remove locale name (first part, e.g., "en", "ar")
    if (pathParts.length > 0) {
      pathParts.shift();
    }

    if (pathParts.length === 0) {
      return "";
    }

    const prefixParts: string[] = [];
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      // Last part is the filename
      if (i === pathParts.length - 1) {
        const filename = part.replace(".json", "");
        if (filename !== "common" && filename !== "index") {
          prefixParts.push(filename);
        }
      } else {
        prefixParts.push(part);
      }
    }

    return prefixParts.join(".");
  }

  private stripComments(code: string): string {
    let result = code;
    result = result.replace(/\/\*[\s\S]*?\*\//gm, (match) => {
      return match.replace(/[^\n]/g, " ");
    });
    result = result.replace(/^(\s*)\/\/.*$/gm, (match, indent) => {
      return indent;
    });
    result = result.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/gm, (match) => {
      return match.replace(/[^\n]/g, " ");
    });
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
        this.usedKeysPerRoot.clear();
        return;
      }

      const functionNames = await this.configManager.getFunctionNames();
      const includeGlob = "**/*.{ts,tsx,js,jsx,vue,svelte,html}";
      const excludeGlob = "**/node_modules/**";

      const files = await workspace.findFiles(includeGlob, excludeGlob);

      // Map<RootPath, Set<Key>>
      const newUsedKeysPerRoot = new Map<string, Set<string>>();

      const relCallPattern = new RegExp(
        "(?:^|[^A-Za-z0-9_])(?:" +
          functionNames.map((n) => n.replace(/\./g, "\\.")).join("|") +
          ")\\s*\\(\\s*[\"'`]([^\"'`]+)[\"'`]",
        "gm",
      );
      const baseKeyRegex = /useTranslations?\s*\(\s*[\"'`]([^\"'`]+)[\"'`]/gm;

      for (const uri of files) {
        try {
          // Identify which roots this file is relevant for
          const relevantRoots =
            await this.configManager.resolveLocaleRoots(uri);

          if (relevantRoots.length === 0) continue;

          const bytes = await workspace.fs.readFile(uri);
          let text = Buffer.from(bytes).toString("utf8");

          text = this.stripComments(text);

          const baseKeys = new Set<string>();
          let bm: RegExpExecArray | null;
          while ((bm = baseKeyRegex.exec(text)) !== null) {
            if (bm[1]) baseKeys.add(bm[1]);
          }

          const fileUsedKeys = new Set<string>();

          let m: RegExpExecArray | null;
          while ((m = relCallPattern.exec(text)) !== null) {
            const raw = m[1];
            if (!raw) continue;
            fileUsedKeys.add(raw);
            for (const base of baseKeys) {
              if (!raw.startsWith(base + "."))
                fileUsedKeys.add(`${base}.${raw}`);
            }
          }

          // Add found keys to ALL relevant roots
          for (const key of fileUsedKeys) {
            for (const root of relevantRoots) {
              let rootSet = newUsedKeysPerRoot.get(root);
              if (!rootSet) {
                rootSet = new Set();
                newUsedKeysPerRoot.set(root, rootSet);
              }
              rootSet.add(key);
            }
          }
        } catch {
          // ignore file read issues
        }
      }

      this.usedKeysPerRoot = newUsedKeysPerRoot;
    } finally {
      this.isComputing = false;
    }
  }
}
