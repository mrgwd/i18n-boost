import { findKeyPosition } from "../../src/utils/keyFinder";
import { strict as assert } from "assert";

describe("findKeyPosition", () => {
  it("finds a simple key at the root", () => {
    const json = '{ "hello": "world" }';
    const pos = findKeyPosition("hello", json);
    assert(pos !== null, "Should find the key");
    if (pos) {
      assert.equal(pos.line, 0, "Should be on the first line");
    }
  });

  it("returns null for missing key", () => {
    const json = '{ "hello": "world" }';
    const pos = findKeyPosition("missing", json);
    assert.equal(pos, null, "Should not find the key");
  });

  it("finds a nested key", () => {
    const json = `
    {
      "user": {
        "profile": {
          "name": "Alice"
        }
      }
    }
    `;
    const pos = findKeyPosition("user.profile.name", json);
    assert(pos !== null, "Should find the nested key");
  });

  it("returns null for missing nested key", () => {
    const json = `
    {
      "user": {
        "profile": {
          "name": "Alice"
        }
      }
    }
    `;
    const pos = findKeyPosition("user.profile.age", json);
    assert.equal(pos, null, "Should not find the missing nested key");
  });

  it("handles arrays in JSON", () => {
    const json = `
    {
      "items": [
        { "name": "A" },
        { "name": "B" }
      ]
    }
    `;
    const pos = findKeyPosition("items", json);
    assert(pos !== null, "Should find the array key");
  });
});
