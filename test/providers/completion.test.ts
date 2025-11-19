import { strict as assert } from "assert";
import "../setup";
import { I18nCompletionProvider } from "../../src/providers/completion";
import { beforeEach, describe, it } from "mocha";

describe("I18n Completion Provider", () => {
  let provider: I18nCompletionProvider;
  let mockConfigManager: any;

  beforeEach(() => {
    // Create mock config manager
    mockConfigManager = {
      isEnabled: () => Promise.resolve(true),
      getDefaultLocale: () => Promise.resolve("en"),
      getFunctionNames: () => Promise.resolve(["t", "translate"]),
      getLocaleFilePath: (locale: string) =>
        Promise.resolve(`/path/to/locales/${locale}.json`),
    };

    // Create provider
    provider = new I18nCompletionProvider(mockConfigManager);
  });

  describe("when config is disabled", () => {
    it("should return empty array", async () => {
      mockConfigManager.isEnabled = () => Promise.resolve(false);

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

  describe("duplicate suggestions", () => {
    it("should not suggest current path when user types with trailing dot", async () => {
      // Mock translations with nested structure
      const mockTranslations = {
        dashboard: {
          sidebar: "Sidebar",
          home: "Home",
          stats: "Stats",
        },
      };

      // Mock the loadTranslations method to set the translations
      (provider as any).loadTranslations = () => {
        (provider as any).translations = mockTranslations;
      };

      // Call loadTranslations to set the translations
      await (provider as any).loadTranslations();

      const mockDocument = {
        lineAt: () => ({
          text: 't("dashboard.")',
          substring: () => 't("dashboard.")',
        }),
      };
      const mockPosition = { line: 0, character: 13 }; // Position after "dashboard."

      const result = await provider.provideCompletionItems(
        mockDocument as any,
        mockPosition as any
      );

      // Should suggest child keys but not "dashboard." itself
      assert.strictEqual(result.length, 3, "Should have 3 suggestions");

      const suggestionLabels = result.map((item) => item.label);
      assert(suggestionLabels.includes("sidebar"), "Should include 'sidebar'");
      assert(suggestionLabels.includes("home"), "Should include 'home'");
      assert(suggestionLabels.includes("stats"), "Should include 'stats'");
      assert(
        !suggestionLabels.includes("dashboard"),
        "Should NOT include 'dashboard'"
      );
    });

    it("should not suggest current path when user types nested path with trailing dot", async () => {
      // Mock translations with deeper nesting
      const mockTranslations = {
        dashboard: {
          sidebar: {
            menu: "Menu",
            slogan: "Slogan",
          },
        },
      };

      // Mock the loadTranslations method to set the translations
      (provider as any).loadTranslations = () => {
        (provider as any).translations = mockTranslations;
      };

      // Call loadTranslations to set the translations
      await (provider as any).loadTranslations();

      const mockDocument = {
        lineAt: () => ({
          text: 't("dashboard.sidebar.")',
          substring: () => 't("dashboard.sidebar.")',
        }),
      };
      const mockPosition = { line: 0, character: 21 }; // Position after "dashboard.sidebar."

      const result = await provider.provideCompletionItems(
        mockDocument as any,
        mockPosition as any
      );

      // Should suggest child keys but not "sidebar." itself
      assert.strictEqual(result.length, 2, "Should have 2 suggestions");

      const suggestionLabels = result.map((item) => item.label);
      assert(suggestionLabels.includes("menu"), "Should include 'menu'");
      assert(suggestionLabels.includes("slogan"), "Should include 'slogan'");
      assert(
        !suggestionLabels.includes("sidebar"),
        "Should NOT include 'sidebar'"
      );
    });
  });

  describe("constructor", () => {
    it("should create provider instance", () => {
      assert(provider, "Should create provider instance");
    });
  });
});
