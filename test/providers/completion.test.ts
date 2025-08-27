import { strict as assert } from "assert";
import "../setup";
import { mockVscode } from "../setup";
import { I18nCompletionProvider } from "../../src/providers/completion";
import { ConfigManager } from "../../src/utils/configManager";

describe("I18n Completion Provider", () => {
  let provider: I18nCompletionProvider;
  let mockConfigManager: any;

  beforeEach(() => {
    // Create mock config manager
    mockConfigManager = {
      loadConfig: () =>
        Promise.resolve({
          localesPath: "/path/to/locales",
          defaultLocale: "en",
          supportedLocales: ["en", "es"],
          functionNames: ["t", "translate"],
          fileNamingPattern: "locale.json",
          enabled: true,
        }),
      getLocaleFilePath: (locale: string) => `/path/to/locales/${locale}.json`,
    };

    // Create provider
    provider = new I18nCompletionProvider(mockConfigManager);
  });

  describe("when config is disabled", () => {
    it("should return empty array", async () => {
      mockConfigManager.loadConfig = () =>
        Promise.resolve({
          enabled: false,
          functionNames: ["t"],
        });

      const mockDocument = {
        lineAt: () => ({ text: 't("")', substring: () => 't("")' }),
      };
      const mockPosition = { line: 0, character: 4 };

      const result = await provider.provideCompletionItems(
        mockDocument as any,
        mockPosition as any
      );

      assert.strictEqual(
        result.length,
        0,
        "Should return empty array when disabled"
      );
    });
  });

  describe("when no config found", () => {
    it("should return empty array", async () => {
      mockConfigManager.loadConfig = () => Promise.resolve(null);

      const mockDocument = {
        lineAt: () => ({ text: 't("")', substring: () => 't("")' }),
      };
      const mockPosition = { line: 0, character: 4 };

      const result = await provider.provideCompletionItems(
        mockDocument as any,
        mockPosition as any
      );

      assert.strictEqual(
        result.length,
        0,
        "Should return empty array when no config"
      );
    });
  });

  describe("constructor", () => {
    it("should create provider instance", () => {
      assert(provider, "Should create provider instance");
    });
  });
});
