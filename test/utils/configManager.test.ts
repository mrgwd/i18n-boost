import { strict as assert } from "assert";
import "../setup";
import { mockVscode } from "../setup";
import { ConfigManager } from "../../src/utils/configManager";

describe("ConfigManager", () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    // Create config manager
    configManager = new ConfigManager();
  });

  describe("getWorkspacePath", () => {
    it("should return null when no workspace folders", () => {
      (mockVscode.workspace as any).workspaceFolders = undefined;

      const result = configManager.getWorkspacePath();

      assert.strictEqual(
        result,
        null,
        "Should return null when no workspace folders"
      );
    });
  });

  describe("getLocalesPath", () => {
    it("should return null when no config loaded", () => {
      const result = configManager.getLocalesPath();

      assert.strictEqual(result, null, "Should return null when no config");
    });
  });

  describe("getAvailableLocales", () => {
    it("should return empty array when no config", async () => {
      const result = await configManager.getAvailableLocales();

      assert.deepStrictEqual(
        result,
        [],
        "Should return empty array when no config"
      );
    });
  });

  describe("resetCache", () => {
    it("should reset cached config", () => {
      // This test verifies the method exists and can be called
      assert.doesNotThrow(() => {
        configManager.resetCache();
      }, "Should not throw when resetting cache");
    });
  });
});
