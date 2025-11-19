import { strict as assert } from "assert";
import "../setup";
import { I18nCodeLensProvider } from "../../src/providers/codeLens";
import { beforeEach, describe, it } from "mocha";

describe("I18n Code Lens Provider", () => {
  let provider: I18nCodeLensProvider;
  let mockConfigManager: any;

  beforeEach(() => {
    // Create mock config manager
    mockConfigManager = {
      isEnabled: () => Promise.resolve(true),
      getSupportedLocales: () =>
        Promise.resolve([
          { locale: "en", path: "/path/to/locales/en.json", exists: true },
          { locale: "fr", path: "/path/to/locales/fr.json", exists: true },
          { locale: "de", path: "/path/to/locales/de.json", exists: true },
        ]),
      getLocalesPath: () => Promise.resolve("locales"),
      getFileNamingPattern: () => Promise.resolve("locale.json"),
    };

    // Create provider
    provider = new I18nCodeLensProvider(mockConfigManager);
  });

  describe("when extension is disabled", () => {
    it("should return empty array", async () => {
      mockConfigManager.isEnabled = () => Promise.resolve(false);

      const mockDocument = {
        languageId: "json",
        uri: { fsPath: "/path/to/locales/en.json" },
        getText: () => '{"title": "Welcome"}',
      };

      const result = await provider.provideCodeLenses(
        mockDocument as any,
        {} as any
      );

      assert.strictEqual(
        result.length,
        0,
        "Should return empty array when disabled"
      );
    });
  });

  describe("when not a locale file", () => {
    it("should return empty array", async () => {
      const mockDocument = {
        languageId: "javascript",
        uri: { fsPath: "/path/to/app.js" },
        getText: () => 'console.log("hello");',
      };

      const result = await provider.provideCodeLenses(
        mockDocument as any,
        {} as any
      );

      assert.strictEqual(
        result.length,
        0,
        "Should return empty array for non-locale files"
      );
    });
  });

  describe("when no other locales exist", () => {
    it("should return empty array", async () => {
      mockConfigManager.getSupportedLocales = () =>
        Promise.resolve([
          { locale: "en", path: "/path/to/locales/en.json", exists: true },
        ]);

      const mockDocument = {
        languageId: "json",
        uri: { fsPath: "/path/to/locales/en.json" },
        getText: () => '{"title": "Welcome"}',
      };

      const result = await provider.provideCodeLenses(
        mockDocument as any,
        {} as any
      );

      assert.strictEqual(
        result.length,
        0,
        "Should return empty array when no other locales"
      );
    });
  });

  describe("constructor", () => {
    it("should create provider instance", () => {
      assert.ok(provider, "Should create provider instance");
    });
  });
});
