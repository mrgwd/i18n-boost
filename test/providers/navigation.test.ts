import { strict as assert } from "assert";
import "../setup";
import { mockVscode } from "../setup";
import { I18nNavigationProvider } from "../../src/providers/navigation";
import { ConfigManager } from "../../src/utils/configManager";

describe("I18n Navigation Provider", () => {
  let provider: I18nNavigationProvider;
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
    provider = new I18nNavigationProvider(mockConfigManager);
  });

  describe("when config is disabled", () => {
    it("should return null", async () => {
      mockConfigManager.loadConfig = () =>
        Promise.resolve({
          enabled: false,
          functionNames: ["t"],
        });

      const mockDocument = {
        lineAt: () => ({ text: 't("hello")' }),
      };
      const mockPosition = { line: 0, character: 10 };

      const result = await provider.provideDefinition(
        mockDocument as any,
        mockPosition as any
      );

      assert.strictEqual(
        result,
        null,
        "Should return null when config is disabled"
      );
    });
  });

  describe("when no config found", () => {
    it("should return null", async () => {
      mockConfigManager.loadConfig = () => Promise.resolve(null);

      const mockDocument = {
        lineAt: () => ({ text: 't("hello")' }),
      };
      const mockPosition = { line: 0, character: 10 };

      const result = await provider.provideDefinition(
        mockDocument as any,
        mockPosition as any
      );

      assert.strictEqual(result, null, "Should return null when no config");
    });
  });

  describe("constructor", () => {
    it("should create provider instance", () => {
      assert(provider, "Should create provider instance");
    });
  });
});
