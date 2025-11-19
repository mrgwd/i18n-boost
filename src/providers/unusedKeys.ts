import { parseTree, ParseError, Node as JsonNode } from "jsonc-parser";
import { ConfigManager } from "../utils/configManager";
import {
  Range,
  DiagnosticCollection,
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTag,
  languages,
  workspace,
  TextDocument,
  ExtensionContext,
  Uri,
  RelativePattern,
} from "vscode";
import { extname, normalize, sep } from "path";

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

    for (const k of keys) {
      if (!k.isLeaf) continue;
      if (this.usedKeysCache.has(k.keyPath)) continue;

      const diag = new Diagnostic(
        k.range,
        `Unused i18n key: ${k.keyPath}`,
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

    const docFsPath = document.uri.fsPath;
    const normalizedDoc = normalize(docFsPath);
    const normalizedLocales = normalize(localesPath) + sep;
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
      case "locale/common.json":
        return new RelativePattern(relBase, "*/common.json").pattern;
      case "locale/index.json":
        return new RelativePattern(relBase, "*/index.json").pattern;
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
          const text = Buffer.from(bytes).toString("utf8");

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
