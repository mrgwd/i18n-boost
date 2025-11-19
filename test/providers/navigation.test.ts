import { strict as assert } from "assert";
import "../setup";
import { I18nNavigationProvider } from "../../src/providers/navigation";
import { beforeEach, describe, it } from "mocha";

describe("I18n Navigation Provider", () => {
  let provider: I18nNavigationProvider;
  let mockConfigManager: any;

  beforeEach(() => {
    // Create mock config manager
    mockConfigManager = {
      isEnabled: () => Promise.resolve(true),
      getFunctionNames: () => Promise.resolve(["t", "translate"]),
      getDefaultLocale: () => Promise.resolve("en"),
      getLocaleFilePath: (locale: string) =>
        Promise.resolve(`/path/to/locales/${locale}.json`),
    };

    // Create provider
    provider = new I18nNavigationProvider(mockConfigManager);
  });

  describe("when config is disabled", () => {
    it("should return null", async () => {
      mockConfigManager.isEnabled = () => Promise.resolve(false);

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
