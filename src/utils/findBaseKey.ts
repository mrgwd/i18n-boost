import * as vscode from "vscode";
/**
 * Utility to find the nearest useTranslation("base.key") above the current line
 */
export function findBaseKey(
  document: vscode.TextDocument,
  position: vscode.Position
): string | null {
  const useTranslationRegex = /useTranslations?\s*\(\s*["'\`]([^"'\`]+)["'\`]/;
  for (let lineNum = position.line; lineNum >= 0; lineNum--) {
    const lineText = document.lineAt(lineNum).text;
    const match = useTranslationRegex.exec(lineText);
    if (match) {
      return match[1];
    }
  }
  return null;
}
