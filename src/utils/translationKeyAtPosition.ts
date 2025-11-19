import { Position, TextDocument } from "vscode";
import { ConfigManager } from "./configManager";
import { findBaseKey } from "./findBaseKey";

/**
 * Returns the translation key under the cursor inside configured translation function calls.
 * Applies base-key composition if a base key hook is detected above the position.
 */
export async function getTranslationKeyAtPosition(
  document: TextDocument,
  position: Position,
  configManager: ConfigManager
): Promise<string | null> {
  const enabled = await configManager.isEnabled();
  if (!enabled) return null;

  const functionNames = await configManager.getFunctionNames();
  const line = document.lineAt(position.line).text;
  let translationKey = extractTranslationKeyFromLine(
    line,
    position.character,
    functionNames
  );

  // Compose with base key if available
  const baseKey = findBaseKey(document, position);
  if (baseKey && translationKey && translationKey.length === 0) {
    translationKey = baseKey;
  } else if (
    baseKey &&
    translationKey &&
    !translationKey.startsWith(baseKey + ".")
  ) {
    translationKey = baseKey + "." + translationKey;
  }

  return translationKey ?? null;
}

/**
 * Extracts the translation key from a line at a specific cursor position.
 * Returns the full key if found, or null if not inside a translation function call.
 */
export function extractTranslationKeyFromLine(
  line: string,
  cursorChar: number,
  functionNames: string[]
): string | null {
  const patterns = functionNames.map(
    (name) =>
      new RegExp(
        `\\b${name.replace(".", "\\.")}\\s*\\(\\s*["'\`]([^"'\`]+)["'\`]`,
        "g"
      )
  );

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((match = pattern.exec(line)) !== null) {
      const matchStart = match.index + match[0].indexOf(match[1]);
      const matchEnd = matchStart + match[1].length;

      if (cursorChar >= matchStart && cursorChar <= matchEnd) {
        const fullKey = match[1];
        // Determine which segment the user hovered/clicked on
        return getClickedSegment(fullKey, cursorChar - matchStart);
      }
    }
  }

  return null;
}

function getClickedSegment(fullKey: string, relativeCursorPos: number): string {
  if (relativeCursorPos <= 0) {
    return fullKey;
  }

  const segments = fullKey.split(".");
  let currentPos = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentEnd = currentPos + segment.length;

    if (relativeCursorPos <= segmentEnd) {
      return segments.slice(0, i + 1).join(".");
    }

    currentPos = segmentEnd + 1; // include dot
  }

  return fullKey;
}
