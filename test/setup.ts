// Mock VSCode module globally for tests
const mockVscode: any = {
  languages: {
    createDiagnosticCollection: () => ({
      set: () => {},
      delete: () => {},
      clear: () => {},
      dispose: () => {},
    }),
  },
  workspace: {
    onDidSaveTextDocument: () => ({ dispose: () => {} }),
    onDidOpenTextDocument: () => ({ dispose: () => {} }),
    onDidChangeTextDocument: () => ({ dispose: () => {} }),
    onDidChangeConfiguration: () => ({ dispose: () => {} }),
    createFileSystemWatcher: () => ({
      onDidCreate: () => {},
      onDidChange: () => {},
      onDidDelete: () => {},
      dispose: () => {},
    }),
    findFiles: async () => [],
    textDocuments: [],
    fs: {
      readFile: async () => Buffer.from(""),
    },
  },
  Diagnostic: class MockDiagnostic {
    constructor(
      public range: any,
      public message: string,
      public severity: any
    ) {}
  },
  DiagnosticSeverity: {
    Hint: 3,
  },
  DiagnosticTag: {
    Unnecessary: 1,
  },
  Range: class MockRange {
    constructor(public start: any, public end: any) {}
  },
  Position: class MockPosition {
    constructor(public line: number, public character: number) {}
  },
  RelativePattern: class MockRelativePattern {
    constructor(public base: string, public pattern: string) {
      this.pattern = `${base}/${pattern}`;
    }
  },
  commands: {
    executeCommand: () => Promise.resolve(),
    registerCommand: () => ({ dispose: () => {} }),
  },
};

const Module = require("module");
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id: string) {
  if (id === "vscode") {
    return mockVscode;
  }
  return originalRequire.apply(this, arguments);
};

export { mockVscode };
