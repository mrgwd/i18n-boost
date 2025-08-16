import { getLocation, ParseError, parseTree } from "jsonc-parser";

/**
 * Given the full text of a JSON document and an offset, return the full key path
 * (dot-separated) for the deepest property containing that offset.
 *
 * Uses jsonc-parser to build a tree and then walks up parents to build the path.
 */
export function getKeyPathAtPosition(
  text: string,
  offset: number
): string | null {
  const errors: ParseError[] = [];
  const root = parseTree(text, errors, { allowTrailingComma: true });
  if (!root) return null;

  // Use getLocation to map offset to path (array with property names and array indices)
  const loc = getLocation(text, offset);
  // loc.path is like ['dashboard','sidebar','title'] or ['items',0,'name']
  if (!loc || !loc.path) return null;

  // We want only object property names; ignore numeric indices for now
  const path = loc.path
    .filter((segment) => typeof segment === "string")
    .map(String)
    .join(".");

  return path || null;
}
