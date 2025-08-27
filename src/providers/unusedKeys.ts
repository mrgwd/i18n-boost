import * as vscode from "vscode";
import * as path from "path";
import { parseTree, ParseError, Node as JsonNode } from "jsonc-parser";
import { ConfigManager } from "../utils/configManager";

type KeyWithRange = {
  keyPath: string;
  range: vscode.Range;
  isLeaf: boolean;
};

/**
 * Provides diagnostics that mark unused i18n keys in locale JSON files.
 * Unused keys are tagged as Unnecessary so they appear dimmed in the editor.
 */
export class I18nUnusedKeysDiagnostics {
  private diagnostics: vscode.DiagnosticCollection;
  private usedKeysCache: Set<string> = new Set();
  private recomputeTimer: ReturnType<typeof setTimeout> | null = null;
  private isComputing = false;

  constructor(private readonly configManager: ConfigManager) {
    this.diagnostics = vscode.languages.createDiagnosticCollection(
      "i18n-boost-unused-keys"
    );
  }

  register(context: vscode.ExtensionContext) {
    context.subscriptions.push(this.diagnostics);

    // Initial population (schedule, don't block activation)
    this.scheduleRecompute(300);

    // Recompute when code files are saved (not on each keystroke)
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (this.isCodeFile(doc)) this.scheduleRecompute();
      })
    );

    // Refresh diagnostics when a locale file opens or changes
    context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument((doc) => this.refreshFor(doc))
    );
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((e) =>
        this.refreshFor(e.document)
      )
    );
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((doc) => this.refreshFor(doc))
    );

    // Config changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(() => this.scheduleRecompute())
    );

    // File system watcher for locale directory
    (async () => {
      const localesGlob = await this.getLocalesGlob();
      if (!localesGlob) return;
      const watcher = vscode.workspace.createFileSystemWatcher(localesGlob);
      watcher.onDidCreate((uri) => this.refreshOpenDocForUri(uri));
      watcher.onDidChange((uri) => this.refreshOpenDocForUri(uri));
      watcher.onDidDelete((uri) => this.diagnostics.delete(uri));
      context.subscriptions.push(watcher);
    })();

    // Refresh all currently open locale documents on activation
    for (const doc of vscode.workspace.textDocuments) {
      this.refreshFor(doc);
    }
  }

  private isCodeFile(doc: vscode.TextDocument): boolean {
    const ext = path.extname(doc.uri.fsPath).toLowerCase();
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
    await this.computeUsedKeys();
    for (const doc of vscode.workspace.textDocuments) {
      this.refreshFor(doc);
    }
  }

  private async refreshOpenDocForUri(uri: vscode.Uri) {
    const doc = vscode.workspace.textDocuments.find(
      (d) => d.uri.toString() === uri.toString()
    );
    if (doc) this.refreshFor(doc);
  }

  private async refreshFor(document: vscode.TextDocument) {
    const config = await this.configManager.loadConfig();
    if (!config || !config.enabled) {
      this.diagnostics.clear();
      return;
    }

    if (!(await this.isLocaleDocument(document))) {
      return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const keys = this.collectKeysWithRanges(document);

    for (const k of keys) {
      if (!k.isLeaf) continue;
      if (this.usedKeysCache.has(k.keyPath)) continue;

      const diag = new vscode.Diagnostic(
        k.range,
        `Unused i18n key: ${k.keyPath}`,
        vscode.DiagnosticSeverity.Hint
      );
      diag.tags = [vscode.DiagnosticTag.Unnecessary];
      diagnostics.push(diag);
    }

    this.diagnostics.set(document.uri, diagnostics);
  }

  private async isLocaleDocument(
    document: vscode.TextDocument
  ): Promise<boolean> {
    if (document.languageId !== "json" && document.languageId !== "jsonc") {
      return false;
    }
    const localesPath = this.configManager.getLocalesPath();
    if (!localesPath) return false;

    const docFsPath = document.uri.fsPath;
    const normalizedDoc = path.normalize(docFsPath);
    const normalizedLocales = path.normalize(localesPath) + path.sep;
    return normalizedDoc.startsWith(normalizedLocales);
  }

  private async getLocalesGlob(): Promise<string | null> {
    const config = await this.configManager.loadConfig();
    if (!config) return null;
    const base = this.configManager.getLocalesPath();
    if (!base) return null;
    const relBase = this.toWorkspaceRelativeGlob(base);

    switch (config.fileNamingPattern) {
      case "locale.json":
        return new vscode.RelativePattern(relBase, "*.json").pattern;
      case "locale/common.json":
        return new vscode.RelativePattern(relBase, "*/common.json").pattern;
      case "locale/index.json":
        return new vscode.RelativePattern(relBase, "*/index.json").pattern;
      default:
        return new vscode.RelativePattern(relBase, "**/*.json").pattern;
    }
  }

  private toWorkspaceRelativeGlob(absPath: string): string {
    return absPath;
  }

  private collectKeysWithRanges(document: vscode.TextDocument): KeyWithRange[] {
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

  private keyNameRange(
    document: vscode.TextDocument,
    keyNode: JsonNode
  ): vscode.Range {
    // keyNode includes surrounding quotes. Highlight only the name inside quotes.
    const start = document.positionAt(keyNode.offset + 1);
    const end = document.positionAt(keyNode.offset + keyNode.length - 1);
    return new vscode.Range(start, end);
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
      const config = await this.configManager.loadConfig();
      if (!config || !config.enabled) {
        this.usedKeysCache = new Set();
        return;
      }

      const functionNames = config.functionNames || ["t", "translate"];
      const includeGlob = "**/*.{ts,tsx,js,jsx,vue,svelte,html}";
      const excludeGlob = "**/node_modules/**";

      const files = await vscode.workspace.findFiles(includeGlob, excludeGlob);

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
          const bytes = await vscode.workspace.fs.readFile(uri);
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

      this.usedKeysCache = used;
    } finally {
      this.isComputing = false;
    }
  }
}
