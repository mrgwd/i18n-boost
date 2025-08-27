import * as fs from "fs";
import { parseTree, ParseError } from "jsonc-parser";

export interface KeyPosition {
  line: number;
  character: number;
}

/**
 * Find the position of a translation key in a JSON file
 * Supports both flat keys and nested dot notation (e.g., "user.profile.name")
 */
export async function findKeyInJsonFile(
  key: string,
  filePath: string
): Promise<KeyPosition | null> {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return findKeyPosition(key, content);
  } catch (error) {
    // Error reading file
    return null;
  }
}

/**
 * Find the position of a translation key in JSON content
 */
export function findKeyPosition(
  key: string,
  jsonContent: string
): KeyPosition | null {
  const errors: ParseError[] = [];
  const root = parseTree(jsonContent, errors, { allowTrailingComma: true });

  if (!root || errors.length > 0) {
    // Failed to parse JSON
    return null;
  }

  // Handle nested keys like "dashboard.sidebar.title"
  const keyParts = key.split(".");

  if (keyParts.length === 1) {
    // Simple key search
    return findSimpleKey(key, jsonContent);
  } else {
    // Nested key search using jsonc-parser
    return findNestedKey(keyParts, jsonContent);
  }
}

/**
 * Find a simple (non-nested) key in JSON content
 */
function findSimpleKey(key: string, jsonContent: string): KeyPosition | null {
  const lines = jsonContent.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const keyRegex = new RegExp(`"${escapeRegExp(key)}"`);
    const match = keyRegex.exec(line);

    if (match) {
      // Make sure this is a property key, not a value
      const colonIndex = line.indexOf(":", match.index);
      if (colonIndex > match.index) {
        return {
          line: i,
          character: match.index + 1, // Position after the opening quote
        };
      }
    }
  }

  return null;
}

/**
 * Find a nested key using dot notation (e.g., "user.profile.name")
 */
function findNestedKey(
  keyParts: string[],
  jsonContent: string
): KeyPosition | null {
  // Use getLocation to find if the path exists
  const errors: ParseError[] = [];
  const root = parseTree(jsonContent, errors, { allowTrailingComma: true });

  if (!root) return null;

  // Check if the nested path exists
  let current = root;
  for (const part of keyParts) {
    if (current.type !== "object" || !current.children) {
      return null;
    }

    const child = current.children.find(
      (c) => c.children && c.children[0] && c.children[0].value === part
    );

    if (!child || !child.children || child.children.length < 2) {
      return null;
    }

    current = child.children[1];
  }

  // If we found the nested structure, find the position of the final key
  const finalKey = keyParts[keyParts.length - 1];
  const lines = jsonContent.split("\n");

  // Find the line containing the final key
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const keyRegex = new RegExp(`"${escapeRegExp(finalKey)}"`);
    const match = keyRegex.exec(line);

    if (match) {
      // Verify this is the right context by checking if it's followed by a colon
      const colonIndex = line.indexOf(":", match.index);
      if (colonIndex > match.index) {
        // Additional verification: make sure we're in the right nesting level
        if (isCorrectNestingContext(keyParts, jsonContent, i)) {
          return {
            line: i,
            character: match.index + 1,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Verify that we're in the correct nesting context for the key parts
 */
function isCorrectNestingContext(
  keyParts: string[],
  jsonContent: string,
  lineIndex: number
): boolean {
  const lines = jsonContent.split("\n");
  let foundParts = 0;

  // Look backwards from the current line to verify the nesting structure
  for (let i = lineIndex; i >= 0; i--) {
    const line = lines[i].trim();

    // Check if this line contains one of our parent keys
    if (foundParts < keyParts.length - 1) {
      const targetKey = keyParts[keyParts.length - 2 - foundParts];
      const keyRegex = new RegExp(`"${escapeRegExp(targetKey)}"`);
      if (keyRegex.test(line) && line.includes(":")) {
        foundParts++;
        if (foundParts === keyParts.length - 1) {
          return true;
        }
      }
    }
  }

  return foundParts === keyParts.length - 1;
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
