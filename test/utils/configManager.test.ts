import { strict as assert } from "assert";
import "../setup";
import { mockVscode } from "../setup";
import { ConfigManager } from "../../src/utils/configManager";

describe("ConfigManager", () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    // Reset mock configuration
    (mockVscode.workspace as any).getConfiguration = () => ({
      get: (key: string) => {
        const defaults: Record<string, any> = {
          localesPath: "src/i18n",
          defaultLocale: "en",
          functionNames: ["t", "translate", "$t", "i18n.t"],
          fileNamingPattern: "locale.json",
          enabled: true,
        };
        return defaults[key];
      },
    });

    // Create config manager
    configManager = new ConfigManager();
  });

  describe("loadSettings", () => {
    it("should load default settings", async () => {
      const settings = await configManager.loadSettings();

      assert.strictEqual(settings.localesPath, "src/i18n");
      assert.strictEqual(settings.defaultLocale, "en");
      assert.deepStrictEqual(settings.functionNames, [
        "t",
        "translate",
        "$t",
        "i18n.t",
      ]);
      assert.strictEqual(settings.fileNamingPattern, "locale.json");
      assert.strictEqual(settings.enabled, true);
    });

    it("should cache settings", async () => {
      const settings1 = await configManager.loadSettings();
      const settings2 = await configManager.loadSettings();

      assert.strictEqual(settings1, settings2, "Should return cached settings");
    });
  });

  describe("isEnabled", () => {
    it("should return true by default", async () => {
      const enabled = await configManager.isEnabled();
      assert.strictEqual(enabled, true);
    });

    it("should return false when disabled", async () => {
      (mockVscode.workspace as any).getConfiguration = () => ({
        get: (key: string) => {
          if (key === "enabled") return false;
          return "src/i18n";
        },
      });

      const enabled = await configManager.isEnabled();
      assert.strictEqual(enabled, false);
    });
  });

  describe("getLocalesPath", () => {
    it("should return configured locales path", async () => {
      const localesPath = await configManager.getLocalesPath();
      assert.strictEqual(localesPath, "src/i18n");
    });
  });

  describe("getDefaultLocale", () => {
    it("should return configured default locale", async () => {
      const defaultLocale = await configManager.getDefaultLocale();
      assert.strictEqual(defaultLocale, "en");
    });
  });

  describe("getFunctionNames", () => {
    it("should return configured function names", async () => {
      const functionNames = await configManager.getFunctionNames();
      assert.deepStrictEqual(functionNames, ["t", "translate", "$t", "i18n.t"]);
    });
  });

  describe("getFileNamingPattern", () => {
    it("should return configured file naming pattern", async () => {
      const pattern = await configManager.getFileNamingPattern();
      assert.strictEqual(pattern, "locale.json");
    });
  });

  describe("resetCache", () => {
    it("should reset cached settings", async () => {
      // Load settings first
      await configManager.loadSettings();

      // Reset cache
      configManager.resetCache();

      // Load again - should create new instance
      const settings = await configManager.loadSettings();
      assert.ok(settings, "Should reload settings after cache reset");
    });
  });

  describe("setupConfigurationWatcher", () => {
    it("should return a disposable", () => {
      const watcher = configManager.setupConfigurationWatcher();
      assert.ok(watcher, "Should return a disposable");
      assert.ok(
        typeof watcher.dispose === "function",
        "Should have dispose method"
      );
    });
  });
});
