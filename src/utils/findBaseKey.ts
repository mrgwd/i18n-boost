import { TextDocument, Position } from "vscode";

/**
 * Utility to find the nearest translation hook call (e.g. useTranslation, useTranslations, useI18n, etc.)
 * above the current line. Matches e.g. useTranslation("base.key"), useTranslations('base.key'), useI18n(`base.key`)
 */
export function findBaseKey(
  document: TextDocument,
  position: Position
): string | null {
  // List of hook patterns to detect
  const TRANS_HOOKS = [
    "useTranslation",
    "useTranslations",
    "getTranslations",
    "useI18n",
    "useLocale",
    "useT",
    "useL", // add more as needed
  ];

  // Build a regex for all translation hooks
  // Matches: useTranslation("base.key"), useI18n('base.key'), etc.
  // using ( with optional whitespace, then a string literal (single, double or backtick)
  // Important: The inner group must not close on first quote/backtick, so we can use a single type class group
  // Use a non-capturing group for the quote type, and refer back to the same quote using a backref
  const hookPattern = `(${TRANS_HOOKS.join(
    "|"
  )})\\s*\\(\\s*(["'\`])([^"'\\\`]+)\\2`;

  const translationHookRegex = new RegExp(hookPattern);

  for (let lineNum = position.line; lineNum >= 0; lineNum--) {
    const lineText = document.lineAt(lineNum).text;

    // 1. Match old style (getTranslations("blog")) as before
    const match = translationHookRegex.exec(lineText);
    if (match) {
      return match[3];
    }

    // 2. New: Match object pattern (getTranslations({ ..., namespace: "blog" }))
    // Try to match getTranslations({ ... namespace: "blog" ... })
    // Regex: hookName ( { ... namespace: "blog" ... } )
    const objectPattern = new RegExp(
      `(${TRANS_HOOKS.join(
        "|"
      )})\\s*\\(\\s*\\{[^\\}]*namespace\\s*:\\s*(["'\`])([^"'\\\`]+)\\2`
    );
    const objectMatch = objectPattern.exec(lineText);
    if (objectMatch) {
      return objectMatch[3];
    }
  }
  return null;
}
